import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { createExpense } from '@/domain/services/expenseService'
import { AppError } from '@/shared/types/errors'

async function seedHouseholdWithMember() {
  await db.households.add({
    householdId: 'h1',
    name: 'บ้านทดสอบ',
    baseCurrency: 'THB',
    monthStartDay: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1
  })
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
  await db.members.add({
    memberId: 'bob',
    householdId: 'h1',
    displayName: 'Bob',
    role: 'member',
    color: '#111111',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  })
}

describe('createExpense', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await seedHouseholdWithMember()
  })

  it('persists an expense and its allocation atomically for a personal expense', async () => {
    const expense = await createExpense({
      householdId: 'h1',
      expenseDate: '2026-01-10',
      amount: 120,
      currency: 'THB',
      categoryId: 'cat1',
      paidByMemberId: 'alice',
      expenseType: 'personal',
      description: 'ของใช้ส่วนตัว',
      tags: [],
      status: 'active',
      allocationType: 'equal',
      allocationEntries: [],
      idempotencyKey: 'idem-1'
    })
    const allocations = await db.expenseAllocations.where('expenseId').equals(expense.expenseId).toArray()
    expect(allocations).toHaveLength(1)
    expect(allocations[0].allocatedAmount).toBe(120)
  })

  it('is idempotent: retrying the same submission never creates a duplicate row (VAL-012, BR-009)', async () => {
    const input = {
      householdId: 'h1',
      expenseDate: '2026-01-10',
      amount: 100,
      currency: 'THB',
      categoryId: 'cat1',
      paidByMemberId: 'alice',
      expenseType: 'shared' as const,
      description: 'ค่าอาหาร',
      tags: [],
      status: 'active' as const,
      allocationType: 'equal' as const,
      allocationEntries: [{ memberId: 'alice' }, { memberId: 'bob' }],
      idempotencyKey: 'retry-key'
    }
    const first = await createExpense(input)
    const second = await createExpense(input)
    expect(second.expenseId).toBe(first.expenseId)
    const count = await db.expenses.count()
    expect(count).toBe(1)
  })

  it('rolls back the whole transaction when allocation is unbalanced (NFR-003)', async () => {
    await expect(
      createExpense({
        householdId: 'h1',
        expenseDate: '2026-01-10',
        amount: 100,
        currency: 'THB',
        categoryId: 'cat1',
        paidByMemberId: 'alice',
        expenseType: 'shared',
        description: 'ค่าอาหาร',
        tags: [],
        status: 'active',
        allocationType: 'exact',
        allocationEntries: [
          { memberId: 'alice', exactAmount: 40 },
          { memberId: 'bob', exactAmount: 40 }
        ],
        idempotencyKey: 'imbalanced-1'
      })
    ).rejects.toThrow(AppError)

    expect(await db.expenses.count()).toBe(0)
    expect(await db.expenseAllocations.count()).toBe(0)
  })

  it('rejects a non-positive amount for non-adjustment expense types (BR-002)', async () => {
    await expect(
      createExpense({
        householdId: 'h1',
        expenseDate: '2026-01-10',
        amount: 0,
        currency: 'THB',
        categoryId: 'cat1',
        paidByMemberId: 'alice',
        expenseType: 'personal',
        description: '',
        tags: [],
        status: 'active',
        allocationType: 'equal',
        allocationEntries: [],
        idempotencyKey: 'zero-amount'
      })
    ).rejects.toThrow(AppError)
  })
})
