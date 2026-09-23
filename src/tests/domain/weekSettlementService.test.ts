import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { createExpense } from '@/domain/services/expenseService'
import { clearWeek, getWeekSettlement, listUnclearedWeeks, unclearWeek } from '@/domain/services/weekSettlementService'
import { AppError } from '@/shared/types/errors'

async function seedMember() {
  await db.members.add({
    memberId: 'alice',
    householdId: 'h1',
    displayName: 'Alice',
    role: 'admin',
    color: '#000000',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  })
}

async function addExpense(overrides: Partial<Parameters<typeof createExpense>[0]> = {}) {
  await createExpense({
    householdId: 'h1',
    expenseDate: '2026-01-06',
    amount: 100,
    currency: 'THB',
    categoryId: 'cat1',
    paidByMemberId: 'alice',
    expenseType: 'personal',
    description: '',
    tags: [],
    status: 'active',
    allocationType: 'equal',
    allocationEntries: [],
    idempotencyKey: `idem-${Math.random()}`,
    ...overrides
  })
}

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

describe('listUnclearedWeeks', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await seedMember()
  })

  it('groups spendable expenses into weeks and sums each week, most recent first', async () => {
    await addExpense({ expenseDate: '2026-01-06', amount: 100 }) // week 2026-01-05..11
    await addExpense({ expenseDate: '2026-01-08', amount: 50 }) // same week
    await addExpense({ expenseDate: '2026-01-13', amount: 30 }) // week 2026-01-12..18

    const weeks = await listUnclearedWeeks('h1')
    expect(weeks).toEqual([
      { weekStart: '2026-01-12', weekEnd: '2026-01-18', total: 30 },
      { weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 150 }
    ])
  })

  it('excludes weeks that already have an active cleared record', async () => {
    await addExpense({ expenseDate: '2026-01-06', amount: 100 })
    await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 100 })

    expect(await listUnclearedWeeks('h1')).toEqual([])
  })

  it('brings a week back once its clear is undone', async () => {
    await addExpense({ expenseDate: '2026-01-06', amount: 100 })
    const cleared = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 100 })
    await unclearWeek(cleared.weekSettlementId)

    expect(await listUnclearedWeeks('h1')).toEqual([{ weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 100 }])
  })

  it('ignores income entries and non-active expenses', async () => {
    await addExpense({ expenseDate: '2026-01-06', amount: 500, expenseType: 'income' })
    await addExpense({ expenseDate: '2026-01-06', amount: 200, status: 'draft' })

    expect(await listUnclearedWeeks('h1')).toEqual([])
  })
})
