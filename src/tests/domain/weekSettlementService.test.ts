import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { clearWeek, getWeekSettlement, unclearWeek } from '@/domain/services/weekSettlementService'
import { AppError } from '@/shared/types/errors'

describe('weekSettlementService', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('has no active clear record for a week until one is created', async () => {
    const status = await getWeekSettlement('h1', '2026-01-05', '2026-01-11')
    expect(status).toBeUndefined()
  })

  it('clears a week using the given total, without any amount being typed in', async () => {
    const record = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 1150 })
    expect(record.status).toBe('cleared')
    expect(record.total).toBe(1150)

    const status = await getWeekSettlement('h1', '2026-01-05', '2026-01-11')
    expect(status?.weekSettlementId).toBe(record.weekSettlementId)
  })

  it('is idempotent: clearing an already-cleared week returns the same record instead of duplicating it', async () => {
    const first = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 1150 })
    const second = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 1150 })
    expect(second.weekSettlementId).toBe(first.weekSettlementId)
    expect(await db.weekSettlements.count()).toBe(1)
  })

  it('undoes a wrongly-recorded clear without hard-deleting it, so a fresh clear can be recorded again', async () => {
    const record = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 1150 })
    await unclearWeek(record.weekSettlementId)

    expect(await getWeekSettlement('h1', '2026-01-05', '2026-01-11')).toBeUndefined()
    const voided = await db.weekSettlements.get(record.weekSettlementId)
    expect(voided?.status).toBe('voided')

    const recleared = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 900 })
    expect(recleared.weekSettlementId).not.toBe(record.weekSettlementId)
    expect(recleared.total).toBe(900)
  })

  it('rejects undoing a clear that does not exist', async () => {
    await expect(unclearWeek('missing')).rejects.toThrow(AppError)
  })
})
