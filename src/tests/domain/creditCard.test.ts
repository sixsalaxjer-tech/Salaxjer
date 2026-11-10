import { describe, expect, it } from 'vitest'
import { getDueDate, getPreviousCycle, getStatementCycle, summarizeCard } from '@/domain/rules/creditCard'
import type { CardPayment, CreditCard, Expense } from '@/domain/entities/types'

const card: CreditCard = {
  creditCardId: 'c1',
  householdId: 'h1',
  name: 'KTC',
  statementDay: 10,
  dueDay: 25,
  creditLimit: 50000,
  color: '#000',
  status: 'active',
  createdAt: '',
  updatedAt: ''
}

function exp(date: string, amount: number, extra: Partial<Expense> = {}): Expense {
  return {
    expenseId: `${date}-${amount}`,
    householdId: 'h1',
    expenseDate: date,
    amount,
    currency: 'THB',
    categoryId: 'cat',
    paidByMemberId: 'm',
    expenseType: 'personal',
    description: '',
    tags: [],
    status: 'active',
    syncStatus: 'local_only',
    clientUpdatedAt: '',
    version: 1,
    idempotencyKey: `${date}-${amount}`,
    creditCardId: 'c1',
    ...extra
  }
}

function pay(date: string, amount: number, status: CardPayment['status'] = 'confirmed'): CardPayment {
  return {
    cardPaymentId: `${date}-${amount}`,
    householdId: 'h1',
    creditCardId: 'c1',
    amount,
    paymentDate: date,
    status,
    createdAt: '',
    updatedAt: ''
  }
}

describe('statement cycles', () => {
  it('puts a charge on the statement day on that statement', () => {
    expect(getStatementCycle('2026-11-10', 10)).toEqual({ start: '2026-10-11', end: '2026-11-10' })
  })
  it('rolls to next month after the statement day', () => {
    expect(getStatementCycle('2026-11-11', 10)).toEqual({ start: '2026-11-11', end: '2026-12-10' })
  })
  it('crosses the year boundary', () => {
    expect(getStatementCycle('2026-12-20', 10)).toEqual({ start: '2026-12-11', end: '2027-01-10' })
    expect(getStatementCycle('2027-01-05', 10)).toEqual({ start: '2026-12-11', end: '2027-01-10' })
  })
  it('clamps day 31 to short months', () => {
    expect(getStatementCycle('2027-02-15', 31)).toEqual({ start: '2027-02-01', end: '2027-02-28' })
    expect(getStatementCycle('2027-03-01', 31)).toEqual({ start: '2027-03-01', end: '2027-03-31' })
  })
  it('previous cycle is directly before the current one', () => {
    expect(getPreviousCycle('2026-11-15', 10)).toEqual({ start: '2026-10-11', end: '2026-11-10' })
  })
})

describe('due date', () => {
  it('is the same month when dueDay is after statementDay', () => {
    expect(getDueDate('2026-11-10', 10, 25)).toBe('2026-11-25')
  })
  it('is the next month when dueDay is on/before statementDay', () => {
    expect(getDueDate('2026-11-25', 25, 10)).toBe('2026-12-10')
  })
})

describe('summarizeCard', () => {
  const expenses = [
    exp('2026-10-05', 1000), // older statement
    exp('2026-10-20', 500), // last statement (10-11..11-10)
    exp('2026-11-12', 300), // current cycle
    exp('2026-11-12', 999, { status: 'voided' }),
    exp('2026-11-12', 999, { status: 'draft' }),
    exp('2026-11-12', 999, { expenseType: 'income' }),
    exp('2026-11-12', 999, { creditCardId: 'other' })
  ]

  it('computes outstanding, unbilled, statement due and due date', () => {
    const s = summarizeCard(card, expenses, [], '2026-11-15')
    expect(s.outstanding).toBe(1800)
    expect(s.unbilled).toBe(300)
    expect(s.statementDue).toBe(1500)
    expect(s.lastStatementAmount).toBe(500)
    expect(s.dueDate).toBe('2026-11-25')
    expect(s.overdue).toBe(false)
    expect(s.available).toBe(48200)
  })

  it('payments reduce outstanding; voided payments do not', () => {
    const s = summarizeCard(card, expenses, [pay('2026-11-16', 1500), pay('2026-11-17', 200, 'voided')], '2026-11-18')
    expect(s.outstanding).toBe(300)
    expect(s.statementDue).toBe(0)
    expect(s.overdue).toBe(false)
  })

  it('flags overdue after the due date with an unpaid statement', () => {
    const s = summarizeCard(card, expenses, [], '2026-11-26')
    expect(s.overdue).toBe(true)
  })
})

describe('payment method split', () => {
  it('separates card and non-card expenses', async () => {
    const { matchesMethod } = await import('@/domain/services/dashboardService')
    const onCard = exp('2026-11-01', 100)
    const cash = exp('2026-11-01', 50, { creditCardId: undefined })
    expect(matchesMethod(onCard, 'card')).toBe(true)
    expect(matchesMethod(onCard, 'cash')).toBe(false)
    expect(matchesMethod(cash, 'card')).toBe(false)
    expect(matchesMethod(cash, 'cash')).toBe(true)
    expect(matchesMethod(cash)).toBe(true)
  })
})
