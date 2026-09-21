import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { pushWeekSettlement } from '@/infrastructure/sync/syncEngine'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { APP_CONFIG } from '@/shared/constants/config'
import type { WeekSettlement } from '@/domain/entities/types'

/** Returns the active (non-voided) clear record for this exact week, if any — used to drive the
 * "เคลียร์ยอด" toggle on WeeklySummaryCard. */
export async function getWeekSettlement(
  householdId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeekSettlement | undefined> {
  const rows = await db.weekSettlements.where('[householdId+weekStart]').equals([householdId, weekStart]).toArray()
  return rows.find((r) => r.weekEnd === weekEnd && r.status === 'cleared')
}

export interface ClearWeekInput {
  householdId: string
  weekStart: string
  weekEnd: string
  total: number
}

/** Marks a week as cleared/settled. `total` is always the week's own computed total (passed in
 * by the caller from the same breakdown shown on screen) — never typed by hand. Idempotent: if
 * the week is already cleared, returns the existing record instead of creating a duplicate. */
export async function clearWeek(input: ClearWeekInput): Promise<WeekSettlement> {
  const existing = await getWeekSettlement(input.householdId, input.weekStart, input.weekEnd)
  if (existing) return existing

  const now = nowIso()
  const record: WeekSettlement = {
    weekSettlementId: uuidv4(),
    householdId: input.householdId,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    total: input.total,
    status: 'cleared',
    clearedAt: now,
    createdAt: now,
    updatedAt: now
  }
  await db.transaction('rw', db.weekSettlements, db.auditLogs, async () => {
    await db.weekSettlements.add(record)
    await recordAudit(db.auditLogs, {
      householdId: input.householdId,
      entityType: 'week_settlement',
      entityId: record.weekSettlementId,
      action: 'clear_week_settlement',
      details: { weekStart: input.weekStart, weekEnd: input.weekEnd, total: input.total }
    })
  })
  if (APP_CONFIG.syncEnabled) void pushWeekSettlement(record)
  return record
}

/** Undoes a wrongly-recorded clear. Never hard-deleted, only voided — same pattern as
 * voidSettlement/void_expense — so the audit trail and any synced copies stay consistent. */
export async function unclearWeek(weekSettlementId: string): Promise<void> {
  let updated: WeekSettlement | undefined
  await db.transaction('rw', db.weekSettlements, db.auditLogs, async () => {
    const existing = await db.weekSettlements.get(weekSettlementId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบรายการ')
    updated = { ...existing, status: 'voided', updatedAt: nowIso() }
    await db.weekSettlements.put(updated)
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'week_settlement',
      entityId: weekSettlementId,
      action: 'void_week_settlement',
      details: {}
    })
  })
  if (APP_CONFIG.syncEnabled && updated) void pushWeekSettlement(updated)
}
