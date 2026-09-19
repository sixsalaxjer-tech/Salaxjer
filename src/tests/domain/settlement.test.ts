import { describe, expect, it } from 'vitest'
import { computeNetBalances, computeSuggestedTransfers } from '@/domain/rules/settlement'
import type { Expense, ExpenseAllocation, Settlement } from '@/domain/entities/types'

function expense(overrides: Partial<Expense>): Expense {
  return {
    expenseId: 'e1',
    householdId: 'h1',
    expenseDate: '2026-01-01',
    amount: 100,
    currency: 'THB',
    categoryId: 'c1',
    paidByMemberId: 'alice',
    expenseType: 'shared',
    description: '',
    tags: [],
    status: 'active',
    syncStatus: 'local_only',
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    idempotencyKey: 'k1',
    ...overrides
  }
}

describe('computeNetBalances', () => {
  it('nets out to zero when one member pays for a shared expense split equally', () => {
    const expenses = [expense({ expenseId: 'e1', paidByMemberId: 'alice', amount: 100 })]
    const allocations: ExpenseAllocation[] = [
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 50 },
      { allocationId: 'a2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 50 }
    ]
    const balances = computeNetBalances('THB', expenses, allocations, [])
    const total = balances.reduce((s, b) => s + b.netAmount, 0)
    expect(total).toBeCloseTo(0, 2)
    expect(balances.find((b) => b.memberId === 'alice')?.netAmount).toBeCloseTo(50, 2)
    expect(balances.find((b) => b.memberId === 'bob')?.netAmount).toBeCloseTo(-50, 2)
  })

  it('ignores voided and draft expenses (BR-010)', () => {
    const expenses = [
      expense({ expenseId: 'e1', status: 'voided' }),
      expense({ expenseId: 'e2', status: 'draft' })
    ]
    const allocations: ExpenseAllocation[] = [
      { allocationId: 'a1', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 100 },
      { allocationId: 'a2', expenseId: 'e2', memberId: 'bob', allocationType: 'equal', allocatedAmount: 100 }
    ]
    const balances = computeNetBalances('THB', expenses, allocations, [])
    expect(balances.every((b) => Math.abs(b.netAmount) < 0.01)).toBe(true)
  })

  it('reduces outstanding balance after a confirmed settlement (FR-007)', () => {
    const expenses = [expense({ expenseId: 'e1', paidByMemberId: 'alice', amount: 100 })]
    const allocations: ExpenseAllocation[] = [
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 50 },
      { allocationId: 'a2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 50 }
    ]
    const settlements: Settlement[] = [
      {
        settlementId: 's1',
        householdId: 'h1',
        fromMemberId: 'bob',
        toMemberId: 'alice',
        amount: 50,
        settlementDate: '2026-01-02',
        status: 'confirmed',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ]
    const balances = computeNetBalances('THB', expenses, allocations, settlements)
    expect(balances.find((b) => b.memberId === 'alice')?.netAmount).toBeCloseTo(0, 2)
    expect(balances.find((b) => b.memberId === 'bob')?.netAmount).toBeCloseTo(0, 2)
  })
})

describe('computeSuggestedTransfers', () => {
  it('minimizes transfers for a three-person imbalance', () => {
    const transfers = computeSuggestedTransfers('THB', [
      { memberId: 'alice', netAmount: 100 },
      { memberId: 'bob', netAmount: -60 },
      { memberId: 'carol', netAmount: -40 }
    ])
    expect(transfers).toHaveLength(2)
    const totalToAlice = transfers.filter((t) => t.toMemberId === 'alice').reduce((s, t) => s + t.amount, 0)
    expect(totalToAlice).toBeCloseTo(100, 2)
  })

  it('produces no transfers when already balanced', () => {
    const transfers = computeSuggestedTransfers('THB', [
      { memberId: 'alice', netAmount: 0 },
      { memberId: 'bob', netAmount: 0 }
    ])
    expect(transfers).toHaveLength(0)
  })
})
