import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { exportBackup, importBackup, parseAndValidateBackup, serializeBackup } from '@/infrastructure/backup/backupService'
import { AppError } from '@/shared/types/errors'

async function seedHousehold(householdId: string) {
  await db.households.add({
    householdId,
    name: 'บ้านทดสอบ',
    baseCurrency: 'THB',
    monthStartDay: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1
  })
}

describe('backup export/import', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('round-trips: validate mode accepts a freshly exported backup', async () => {
    await seedHousehold('h1')
    const file = await exportBackup('h1')
    const raw = serializeBackup(file)
    const report = await importBackup('h1', raw, 'validate')
    expect(report.tableCounts.households).toBe(1)
  })

  it('rejects a tampered (checksum-mismatched) backup file (VAL-011)', async () => {
    await seedHousehold('h1')
    const file = await exportBackup('h1')
    const raw = JSON.parse(serializeBackup(file))
    raw.data.households[0].name = 'ถูกแก้ไขโดยไม่ได้รับอนุญาต'
    await expect(parseAndValidateBackup(JSON.stringify(raw))).rejects.toThrow(AppError)
  })

  it('rejects malformed JSON without touching existing data', async () => {
    await seedHousehold('h1')
    await expect(importBackup('h1', '{ not valid json', 'replace')).rejects.toThrow(AppError)
    const household = await db.households.get('h1')
    expect(household?.name).toBe('บ้านทดสอบ')
  })

  it('rejects a backup with an unsupported schema version', async () => {
    await seedHousehold('h1')
    const file = await exportBackup('h1')
    const raw = JSON.parse(serializeBackup(file))
    raw.schemaVersion = 9999
    await expect(parseAndValidateBackup(JSON.stringify(raw))).rejects.toThrow(AppError)
  })

  it('replace mode restores data from the backup and creates a restore point', async () => {
    await seedHousehold('h1')
    const file = await exportBackup('h1')
    const raw = serializeBackup(file)

    await db.households.update('h1', { name: 'ชื่อที่เปลี่ยนหลัง Export' })
    const report = await importBackup('h1', raw, 'replace')
    expect(report.success).toBeGreaterThan(0)

    const restored = await db.households.get('h1')
    expect(restored?.name).toBe('บ้านทดสอบ')

    const restorePoints = await db.restorePoints.toArray()
    expect(restorePoints.length).toBeGreaterThan(0)
  })

  it('supports password-encrypted backups and rejects the wrong password', async () => {
    await seedHousehold('h1')
    const file = await exportBackup('h1', 'correct-horse')
    const raw = serializeBackup(file)

    await expect(parseAndValidateBackup(raw, 'wrong-password')).rejects.toThrow(AppError)
    const parsed = await parseAndValidateBackup(raw, 'correct-horse')
    expect(parsed.data.households).toHaveLength(1)
  })
})
