import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/infrastructure/db/db'
import { findDuplicateCandidates } from '@/domain/rules/duplicate'
import type { Expense } from '@/domain/entities/types'

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    expenseId: overrides.expenseId ?? 'e1',
    householdId: 'h1',
    expenseDate: '2026-01-05',
    amount: 250,
    currency: 'THB',
    categoryId: 'cat-food',
    paidByMemberId: 'alice',
    expenseType: 'personal',
    description: 'ก๋วยเตี๋ยวมื้อเที่ยง',
    tags: [],
    status: 'active',
    syncStatus: 'local_only',
    clientUpdatedAt: '2026-01-05T12:00:00.000Z',
    version: 1,
    idempotencyKey: overrides.idempotencyKey ?? 'k1',
    ...overrides
  }
}

describe('findDuplicateCandidates', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('flags a same-day, same-amount, same-payer, same-category expense as a candidate (section 17)', async () => {
    await db.expenses.add(makeExpense({ expenseId: 'e1', idempotencyKey: 'k1' }))
    const candidates = await findDuplicateCandidates({
      householdId: 'h1',
      expenseDate: '2026-01-05',
      amount: 250,
      paidByMemberId: 'alice',
      categoryId: 'cat-food',
      description: 'ก๋วยเตี๋ยวมื้อเที่ยง'
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].expenseId).toBe('e1')
  })

  it('does not flag when the amount differs', async () => {
    await db.expenses.add(makeExpense({ expenseId: 'e1', idempotencyKey: 'k1' }))
    const candidates = await findDuplicateCandidates({
      householdId: 'h1',
      expenseDate: '2026-01-05',
      amount: 300,
      paidByMemberId: 'alice',
      categoryId: 'cat-food',
      description: 'ก๋วยเตี๋ยวมื้อเที่ยง'
    })
    expect(candidates).toHaveLength(0)
  })

  it('excludes voided expenses from duplicate candidates', async () => {
    await db.expenses.add(makeExpense({ expenseId: 'e1', idempotencyKey: 'k1', status: 'voided' }))
    const candidates = await findDuplicateCandidates({
      householdId: 'h1',
      expenseDate: '2026-01-05',
      amount: 250,
      paidByMemberId: 'alice',
      categoryId: 'cat-food',
      description: 'ก๋วยเตี๋ยวมื้อเที่ยง'
    })
    expect(candidates).toHaveLength(0)
  })

  it('excludes the record being edited via excludeExpenseId', async () => {
    await db.expenses.add(makeExpense({ expenseId: 'e1', idempotencyKey: 'k1' }))
    const candidates = await findDuplicateCandidates({
      householdId: 'h1',
      expenseDate: '2026-01-05',
      amount: 250,
      paidByMemberId: 'alice',
      categoryId: 'cat-food',
      description: 'ก๋วยเตี๋ยวมื้อเที่ยง',
      excludeExpenseId: 'e1'
    })
    expect(candidates).toHaveLength(0)
  })
})
