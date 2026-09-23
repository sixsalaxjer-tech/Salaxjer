import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { findUnbalancedExpenses, getSettlementSummary } from '@/domain/services/settlementService'
import { clearWeek, unclearWeek } from '@/domain/services/weekSettlementService'
import { AppError } from '@/shared/types/errors'
import type { Expense, ExpenseAllocation } from '@/domain/entities/types'

function expense(overrides: Partial<Expense>): Expense {
  return {
    expenseId: 'e1',
    householdId: 'h1',
    expenseDate: '2026-01-06',
    amount: 100,
    currency: 'THB',
    categoryId: 'c1',
    paidByMemberId: 'alice',
    expenseType: 'shared',
    description: '',
    tags: [],
    status: 'active',
    syncStatus: 'local_only',
    clientUpdatedAt: '2026-01-06T00:00:00.000Z',
    version: 1,
    idempotencyKey: 'k1',
    ...overrides
  }
}

describe('getSettlementSummary', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.expenses.add(expense({ expenseId: 'e1', paidByMemberId: 'alice', amount: 100 }))
    const allocations: ExpenseAllocation[] = [
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 50 },
      { allocationId: 'a2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 50 }
    ]
    await db.expenseAllocations.bulkAdd(allocations)
  })

  it('counts an uncleared week normally, leaving an outstanding balance', async () => {
    const summary = await getSettlementSummary('h1', 'THB')
    expect(summary.balances.find((b) => b.memberId === 'bob')?.netAmount).toBeCloseTo(-50, 2)
  })

  it('drops that week from the balance automatically once it is cleared — no settlement needed', async () => {
    await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 100 })

    const summary = await getSettlementSummary('h1', 'THB')
    expect(summary.balances.every((b) => Math.abs(b.netAmount) < 0.01)).toBe(true)
    expect(summary.suggestedTransfers).toHaveLength(0)
  })

  it('brings the expense back into the balance once a mistaken clear is undone', async () => {
    const cleared = await clearWeek({ householdId: 'h1', weekStart: '2026-01-05', weekEnd: '2026-01-11', total: 100 })
    await unclearWeek(cleared.weekSettlementId)

    const summary = await getSettlementSummary('h1', 'THB')
    expect(summary.balances.find((b) => b.memberId === 'bob')?.netAmount).toBeCloseTo(-50, 2)
  })
})

describe('findUnbalancedExpenses', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('flags an expense whose allocations do not sum to its amount', async () => {
    await db.expenses.add(expense({ expenseId: 'e1', amount: 100, description: 'ค่าซ่อมรถ' }))
    await db.expenseAllocations.bulkAdd([
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 50 },
      { allocationId: 'a2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 40 }
    ])

    const found = await findUnbalancedExpenses('h1', 'THB')
    expect(found).toEqual([
      { expenseId: 'e1', expenseDate: '2026-01-06', description: 'ค่าซ่อมรถ', amount: 100, allocatedTotal: 90 }
    ])

    await expect(getSettlementSummary('h1', 'THB')).rejects.toThrow(AppError)
  })

  it('ignores voided and soft-deleted expenses even if their allocations do not balance', async () => {
    await db.expenses.add(expense({ expenseId: 'e1', amount: 100, status: 'voided' }))
    await db.expenseAllocations.bulkAdd([
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 40 }
    ])

    expect(await findUnbalancedExpenses('h1', 'THB')).toEqual([])
  })

  it('finds nothing wrong for well-formed data', async () => {
    await db.expenses.add(expense({ expenseId: 'e1', amount: 100 }))
    await db.expenseAllocations.bulkAdd([
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 50 },
      { allocationId: 'a2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 50 }
    ])

    expect(await findUnbalancedExpenses('h1', 'THB')).toEqual([])
  })
})
