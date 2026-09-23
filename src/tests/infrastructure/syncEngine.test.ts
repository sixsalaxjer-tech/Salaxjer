import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { pushExpense, replacePulledAllocations } from '@/infrastructure/sync/syncEngine'
import type { Expense, ExpenseAllocation } from '@/domain/entities/types'

interface RecordedCall {
  table: string
  op: 'upsert' | 'delete'
  payload: unknown
}

const calls: RecordedCall[] = []

vi.mock('@/infrastructure/sync/supabaseClient', () => ({
  supabase: {
    from(table: string) {
      return {
        upsert: async (rows: unknown) => {
          calls.push({ table, op: 'upsert', payload: rows })
          return { error: null }
        },
        delete: () => ({
          eq: async (column: string, value: string) => {
            calls.push({ table, op: 'delete', payload: { column, value } })
            return { error: null }
          }
        })
      }
    }
  }
}))

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    expenseId: 'e1',
    householdId: 'h1',
    expenseDate: '2026-01-01',
    amount: 35,
    currency: 'THB',
    categoryId: 'c1',
    paidByMemberId: 'alice',
    expenseType: 'personal',
    description: 'Bts',
    tags: [],
    status: 'active',
    syncStatus: 'pending_sync',
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    idempotencyKey: 'k1',
    ...overrides
  }
}

describe('pushExpense', () => {
  beforeEach(async () => {
    calls.length = 0
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it("deletes the expense's old server-side allocations before upserting the new set", async () => {
    const e = expense()
    await db.expenses.add(e)
    const allocations: ExpenseAllocation[] = [
      { allocationId: 'a1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 35 }
    ]

    await pushExpense(e, allocations)

    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'expenses:upsert',
      'expense_allocations:delete',
      'expense_allocations:upsert'
    ])
    expect(calls[1].payload).toEqual({ column: 'expense_id', value: 'e1' })

    expect((await db.expenses.get('e1'))?.syncStatus).toBe('synced')
  })

  it('still deletes stale allocations even when the new set is empty (draft with no allocations)', async () => {
    const e = expense()
    await db.expenses.add(e)

    await pushExpense(e, [])

    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(['expenses:upsert', 'expense_allocations:delete'])
  })
})

describe('replacePulledAllocations', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('drops local allocations that no longer exist server-side for a pulled expense — the bug behind a tripled allocated total', async () => {
    // Simulates the orphaned rows a pre-fix edit could leave behind: three stale local shares for
    // one expense that should only ever have one, from before pushExpense cleaned up on write.
    await db.expenseAllocations.bulkAdd([
      { allocationId: 'old-1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 35 },
      { allocationId: 'old-2', expenseId: 'e1', memberId: 'bob', allocationType: 'equal', allocatedAmount: 35 },
      { allocationId: 'old-3', expenseId: 'e1', memberId: 'carol', allocationType: 'equal', allocatedAmount: 35 }
    ])

    const fresh: ExpenseAllocation[] = [
      { allocationId: 'new-1', expenseId: 'e1', memberId: 'alice', allocationType: 'equal', allocatedAmount: 35 }
    ]
    await replacePulledAllocations(['e1'], fresh)

    expect(await db.expenseAllocations.where('expenseId').equals('e1').toArray()).toEqual(fresh)
  })

  it('leaves allocations for expenses outside the pulled set untouched', async () => {
    await db.expenseAllocations.add({
      allocationId: 'keep-1',
      expenseId: 'e2',
      memberId: 'alice',
      allocationType: 'equal',
      allocatedAmount: 20
    })

    await replacePulledAllocations(['e1'], [])

    expect(await db.expenseAllocations.where('expenseId').equals('e2').toArray()).toHaveLength(1)
  })
})
