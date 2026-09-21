import { v4 as uuidv4 } from 'uuid'
import { ALL_TABLE_NAMES, SCHEMA_VERSION, db, type BackupTableName } from '@/infrastructure/db/db'
import { sha256Hex } from '@/infrastructure/backup/checksum'
import { decryptWithPassword, encryptWithPassword, type EncryptedPayload } from '@/infrastructure/backup/encryption'
import { recordAudit } from '@/domain/services/auditService'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { logger } from '@/infrastructure/logging/logger'

const APP_VERSION = '0.1.0'
/** Oldest schema version this build can still read and migrate forward from. */
const MIN_SUPPORTED_SCHEMA_VERSION = 1

type BackupData = Record<BackupTableName, unknown[]>

interface BackupFilePlain {
  schemaVersion: number
  appVersion: string
  exportTimestamp: string
  encrypted: false
  checksum: string
  data: BackupData
}

interface BackupFileEncrypted {
  schemaVersion: number
  appVersion: string
  exportTimestamp: string
  encrypted: true
  checksum: string
  cipher: EncryptedPayload
}

export type BackupFile = BackupFilePlain | BackupFileEncrypted

export type RestoreMode = 'validate' | 'replace' | 'merge'

export interface RestoreReport {
  mode: RestoreMode
  success: number
  skipped: number
  conflict: number
  error: number
  tableCounts: Record<BackupTableName, number>
}

async function collectData(householdId: string): Promise<BackupData> {
  const data = {} as BackupData
  data.households = [await db.households.get(householdId)].filter(Boolean)
  data.members = await db.members.where('householdId').equals(householdId).toArray()
  data.categories = await db.categories.where('householdId').equals(householdId).toArray()
  data.expenses = await db.expenses.where('householdId').equals(householdId).toArray()
  data.settlements = await db.settlements.where('householdId').equals(householdId).toArray()
  data.weekSettlements = await db.weekSettlements.where('householdId').equals(householdId).toArray()
  data.auditLogs = await db.auditLogs.where('householdId').equals(householdId).toArray()
  // ExpenseAllocation has no householdId column of its own — it's scoped via its parent Expense.
  const expenseIds = data.expenses.map((e) => (e as { expenseId: string }).expenseId)
  data.expenseAllocations =
    expenseIds.length > 0 ? await db.expenseAllocations.where('expenseId').anyOf(expenseIds).toArray() : []
  return data
}

/** FR-010 Export: gathers every table scoped to the household plus schema version, timestamp, checksum. */
export async function exportBackup(householdId: string, password?: string): Promise<BackupFile> {
  const data = await collectData(householdId)
  const plainJson = JSON.stringify(data)
  const checksum = await sha256Hex(plainJson)
  const base = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportTimestamp: nowIso(),
    checksum
  }

  await recordAudit(db.auditLogs, {
    householdId,
    entityType: 'backup',
    entityId: householdId,
    action: 'export_backup',
    details: { encrypted: Boolean(password) }
  })

  if (password) {
    const cipher = await encryptWithPassword(plainJson, password)
    return { ...base, encrypted: true, cipher }
  }
  return { ...base, encrypted: false, data }
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

function isBackupFileShape(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.exportTimestamp === 'string' &&
    typeof v.checksum === 'string' &&
    typeof v.encrypted === 'boolean'
  )
}

export interface ParsedBackup {
  file: BackupFile
  data: BackupData
}

/** VAL-011: rejects malformed JSON, unsupported schema versions, and checksum mismatches up front. */
export async function parseAndValidateBackup(rawJson: string, password?: string): Promise<ParsedBackup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new AppError('BACKUP_INVALID', 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
  }
  if (!isBackupFileShape(parsed)) {
    throw new AppError('BACKUP_INVALID', 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
  }
  if (parsed.schemaVersion > SCHEMA_VERSION || parsed.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    throw new AppError('BACKUP_VERSION_UNSUPPORTED', 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
  }

  let plainJson: string
  if (parsed.encrypted) {
    if (!password) throw new AppError('BACKUP_INVALID', 'ไฟล์สำรองนี้ถูกเข้ารหัส กรุณาระบุรหัสผ่าน')
    try {
      plainJson = await decryptWithPassword(parsed.cipher, password)
    } catch {
      throw new AppError('BACKUP_INVALID', 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
    }
  } else {
    plainJson = JSON.stringify(parsed.data)
  }

  const recomputed = await sha256Hex(plainJson)
  if (recomputed !== parsed.checksum) {
    throw new AppError('BACKUP_INVALID', 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
  }

  const data = JSON.parse(plainJson) as BackupData
  return { file: parsed, data }
}

async function snapshotCurrentState(householdId: string): Promise<void> {
  const data = await collectData(householdId)
  await db.restorePoints.add({
    restorePointId: uuidv4(),
    createdAt: nowIso(),
    snapshotJson: JSON.stringify(data)
  })
  // Keep only the most recent restore point to bound local storage usage.
  const all = await db.restorePoints.orderBy('createdAt').toArray()
  const stale = all.slice(0, Math.max(0, all.length - 1))
  await db.restorePoints.bulkDelete(stale.map((r) => r.restorePointId))
}

/**
 * FR-010 / section 23 Restore Modes.
 * - validate: parse + checksum only, never touches the database.
 * - replace: snapshot current data, then wipe and bulkPut everything from the backup, in one
 *   transaction so a failure rolls back to the pre-restore state untouched (NFR-008).
 * - merge: upsert by primary key, comparing `version` where present; a lower/equal incoming
 *   version than what's already stored is left alone and counted as a conflict.
 */
export async function importBackup(
  householdId: string,
  rawJson: string,
  mode: RestoreMode,
  password?: string
): Promise<RestoreReport> {
  const { data } = await parseAndValidateBackup(rawJson, password)

  const tableCounts = {} as Record<BackupTableName, number>
  for (const t of ALL_TABLE_NAMES) tableCounts[t] = (data[t] ?? []).length

  if (mode === 'validate') {
    return { mode, success: 0, skipped: 0, conflict: 0, error: 0, tableCounts }
  }

  const report: RestoreReport = { mode, success: 0, skipped: 0, conflict: 0, error: 0, tableCounts }

  try {
    await db.transaction(
      'rw',
      [
        db.households,
        db.members,
        db.categories,
        db.expenses,
        db.expenseAllocations,
        db.settlements,
        db.weekSettlements,
        db.auditLogs,
        db.restorePoints
      ],
      async () => {
        await snapshotCurrentState(householdId)

        if (mode === 'replace') {
          await db.members.where('householdId').equals(householdId).delete()
          await db.categories.where('householdId').equals(householdId).delete()
          const expenseIds = await db.expenses.where('householdId').equals(householdId).primaryKeys()
          await db.expenseAllocations.where('expenseId').anyOf(expenseIds).delete()
          await db.expenses.where('householdId').equals(householdId).delete()
          await db.settlements.where('householdId').equals(householdId).delete()
          await db.weekSettlements.where('householdId').equals(householdId).delete()

          for (const t of ALL_TABLE_NAMES) {
            const rows = (data[t] ?? []) as { householdId?: string }[]
            if (rows.length === 0) continue
            await (db[t] as unknown as { bulkPut: (rows: unknown[]) => Promise<unknown> }).bulkPut(rows)
            report.success += rows.length
          }
        } else {
          // merge
          const idField: Record<BackupTableName, string> = {
            households: 'householdId',
            members: 'memberId',
            categories: 'categoryId',
            expenses: 'expenseId',
            expenseAllocations: 'allocationId',
            settlements: 'settlementId',
            weekSettlements: 'weekSettlementId',
            auditLogs: 'auditLogId'
          }
          for (const t of ALL_TABLE_NAMES) {
            const rows = (data[t] ?? []) as Record<string, unknown>[]
            for (const row of rows) {
              const id = row[idField[t]] as string
              const existing = await (db[t] as unknown as { get: (id: string) => Promise<Record<string, unknown> | undefined> }).get(id)
              if (!existing) {
                await (db[t] as unknown as { add: (r: unknown) => Promise<unknown> }).add(row)
                report.success++
                continue
              }
              const existingVersion = Number(existing.version ?? 0)
              const incomingVersion = Number(row.version ?? 0)
              if (incomingVersion > existingVersion) {
                await (db[t] as unknown as { put: (r: unknown) => Promise<unknown> }).put(row)
                report.success++
              } else {
                report.conflict++
              }
            }
          }
        }

        await recordAudit(db.auditLogs, {
          householdId,
          entityType: 'backup',
          entityId: householdId,
          action: 'import_restore',
          details: { mode, tableCounts }
        })
      }
    )
  } catch (err) {
    logger.log('importBackup', 'error', { errorCode: 'STORAGE_WRITE_FAILED' })
    throw err instanceof AppError ? err : new AppError('STORAGE_WRITE_FAILED', 'บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ', err)
  }

  return report
}

export async function getLatestRestorePoint() {
  return db.restorePoints.orderBy('createdAt').last()
}
