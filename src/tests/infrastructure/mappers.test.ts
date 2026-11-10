import { describe, expect, it } from 'vitest'
import {
  allocationToDb,
  categoryToDb,
  dbToAllocation,
  dbToCategory,
  dbToExpense,
  dbToHousehold,
  dbToMember,
  dbToSettlement,
  dbToWeekSettlement,
  expenseToDb,
  householdToDb,
  memberToDb,
  settlementToDb,
  weekSettlementToDb
} from '@/infrastructure/sync/mappers'
import type {
  Category,
  Expense,
  ExpenseAllocation,
  Household,
  Member,
  Settlement,
  WeekSettlement
} from '@/domain/entities/types'

describe('sync mappers round-trip', () => {
  it('household', () => {
    const h: Household = {
      householdId: 'h1',
      name: 'บ้านทดสอบ',
      baseCurrency: 'THB',
      monthStartDay: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
      inviteCode: 'ABCD1234'
    }
    const row = { ...householdToDb(h), created_at: h.createdAt }
    expect(dbToHousehold(row)).toEqual(h)
  })

  it('member', () => {
    const m: Member = {
      memberId: 'm1',
      householdId: 'h1',
      displayName: 'พ่อ',
      role: 'admin',
      color: '#000',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const row = { ...memberToDb(m, 'h1'), created_at: m.createdAt }
    expect(dbToMember(row)).toEqual(m)
  })

  it('category', () => {
    const c: Category = {
      categoryId: 'c1',
      householdId: 'h1',
      name: 'อาหาร',
      icon: '🍜',
      color: '#fff',
      isDefault: true,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const row = { ...categoryToDb(c, 'h1'), created_at: c.createdAt }
    expect(dbToCategory(row)).toEqual(c)
  })

  it('expense (active, no adjustment reason)', () => {
    const e: Expense = {
      expenseId: 'e1',
      householdId: 'h1',
      expenseDate: '2026-01-05',
      amount: 100,
      currency: 'THB',
      categoryId: 'c1',
      paidByMemberId: 'm1',
      expenseType: 'personal',
      description: 'test',
      tags: ['a', 'b'],
      status: 'active',
      syncStatus: 'synced',
      clientUpdatedAt: '2026-01-05T00:00:00.000Z',
      version: 2,
      idempotencyKey: 'k1'
    }
    expect(dbToExpense(expenseToDb(e))).toEqual(e)
  })

  it('allocation with percentage', () => {
    const a: ExpenseAllocation = {
      allocationId: 'a1',
      expenseId: 'e1',
      memberId: 'm1',
      allocationType: 'percentage',
      percentage: 50,
      allocatedAmount: 50
    }
    expect(dbToAllocation(allocationToDb(a))).toEqual(a)
  })

  it('settlement', () => {
    const s: Settlement = {
      settlementId: 's1',
      householdId: 'h1',
      fromMemberId: 'm1',
      toMemberId: 'm2',
      amount: 50,
      settlementDate: '2026-01-06',
      status: 'confirmed',
      note: 'note',
      createdAt: '2026-01-06T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z'
    }
    const row = { ...settlementToDb(s), created_at: s.createdAt }
    expect(dbToSettlement(row)).toEqual(s)
  })

  it('weekSettlement', () => {
    const w: WeekSettlement = {
      weekSettlementId: 'w1',
      householdId: 'h1',
      weekStart: '2026-01-05',
      weekEnd: '2026-01-11',
      total: 1150,
      status: 'cleared',
      clearedAt: '2026-01-12T00:00:00.000Z',
      createdAt: '2026-01-12T00:00:00.000Z',
      updatedAt: '2026-01-12T00:00:00.000Z'
    }
    const row = { ...weekSettlementToDb(w), created_at: w.createdAt }
    expect(dbToWeekSettlement(row)).toEqual(w)
  })
})

describe('credit card mappers', () => {
  it('round-trips a credit card', async () => {
    const { creditCardToDb, dbToCreditCard } = await import('@/infrastructure/sync/mappers')
    const card = {
      creditCardId: 'c1',
      householdId: 'h1',
      name: 'UOB',
      last4: '2989',
      statementDay: 10,
      dueDay: 25,
      creditLimit: 171251,
      color: '#2563eb',
      status: 'active' as const,
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z'
    }
    expect(dbToCreditCard({ ...creditCardToDb(card), created_at: card.createdAt })).toEqual(card)
  })

  it('round-trips a card payment and an expense card link', async () => {
    const { cardPaymentToDb, dbToCardPayment, expenseToDb, dbToExpense } = await import('@/infrastructure/sync/mappers')
    const p = {
      cardPaymentId: 'p1',
      householdId: 'h1',
      creditCardId: 'c1',
      amount: 500,
      paymentDate: '2026-11-10',
      status: 'confirmed' as const,
      createdAt: 'x',
      updatedAt: 'y'
    }
    expect(dbToCardPayment({ ...cardPaymentToDb(p), created_at: 'x' })).toEqual(p)
    const row = expenseToDb({ creditCardId: 'c1', tags: [], idempotencyKey: 'k' } as never)
    expect(row.credit_card_id).toBe('c1')
    expect(dbToExpense({ ...row, id: 'e', amount: 1 }).creditCardId).toBe('c1')
  })
})
