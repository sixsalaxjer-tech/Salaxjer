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
  expenseToDb,
  householdToDb,
  memberToDb,
  settlementToDb
} from '@/infrastructure/sync/mappers'
import type { Category, Expense, ExpenseAllocation, Household, Member, Settlement } from '@/domain/entities/types'

describe('sync mappers round-trip', () => {
  it('household', () => {
    const h: Household = {
      householdId: 'h1',
      name: 'บ้านทดสอบ',
      baseCurrency: 'THB',
      monthStartDay: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 1
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
})
