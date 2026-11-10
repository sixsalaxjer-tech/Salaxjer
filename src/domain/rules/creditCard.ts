import type { CardPayment, CreditCard, Expense } from '@/domain/entities/types'

// Pure credit-card billing rules: statement cycles, due dates and outstanding balance.
// Dates are ISO yyyy-MM-dd strings handled with plain arithmetic (no timezone drift).

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO date for `day` of the given month, clamped to the month's length (e.g. 31 -> 28/29/30). */
function clampedDate(year: number, month0: number, day: number): string {
  const normalized = new Date(year, month0, 1) // normalizes month overflow (e.g. month0 = 12)
  const y = normalized.getFullYear()
  const m = normalized.getMonth()
  return `${y}-${pad(m + 1)}-${pad(Math.min(day, daysInMonth(y, m)))}`
}

function parts(iso: string): { y: number; m0: number } {
  return { y: Number(iso.slice(0, 4)), m0: Number(iso.slice(5, 7)) - 1 }
}

function plusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface StatementCycle {
  /** First day of charges on this statement (inclusive). */
  start: string
  /** Statement closing date (inclusive). */
  end: string
}

/** The statement cycle that `dateIso` falls into. A charge on the statement day is on that statement. */
export function getStatementCycle(dateIso: string, statementDay: number): StatementCycle {
  const { y, m0 } = parts(dateIso)
  const thisMonthEnd = clampedDate(y, m0, statementDay)
  const end = dateIso <= thisMonthEnd ? thisMonthEnd : clampedDate(y, m0 + 1, statementDay)
  const { y: ey, m0: em } = parts(end)
  const prevEnd = clampedDate(ey, em - 1, statementDay)
  return { start: plusDays(prevEnd, 1), end }
}

/** The cycle immediately before the one containing `dateIso`. */
export function getPreviousCycle(dateIso: string, statementDay: number): StatementCycle {
  return getStatementCycle(plusDays(getStatementCycle(dateIso, statementDay).start, -1), statementDay)
}

/** Payment due date for the statement closing on `statementDateIso`. */
export function getDueDate(statementDateIso: string, statementDay: number, dueDay: number): string {
  const { y, m0 } = parts(statementDateIso)
  return clampedDate(y, dueDay > statementDay ? m0 : m0 + 1, dueDay)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Spending on a card: active, non-deleted, non-income expenses (income would be a refund and is not tracked here). */
export function isCardCharge(e: Expense, creditCardId: string): boolean {
  return e.creditCardId === creditCardId && e.status === 'active' && !e.deletedAt && e.expenseType !== 'income'
}

function sumRange(charges: Expense[], cycle: StatementCycle): number {
  return charges
    .filter((e) => e.expenseDate >= cycle.start && e.expenseDate <= cycle.end)
    .reduce((s, e) => s + e.amount, 0)
}

export interface CardSummary {
  card: CreditCard
  /** Everything charged minus everything repaid (negative when overpaid). */
  outstanding: number
  /** Charges in the current, not-yet-closed cycle. */
  unbilled: number
  currentCycle: StatementCycle
  /** Amount owed on closed statements = outstanding minus unbilled, never below 0. */
  statementDue: number
  lastStatement: StatementCycle
  lastStatementAmount: number
  /** Due date for the last closed statement. */
  dueDate: string
  /** True when statementDue > 0 and today is past dueDate. */
  overdue: boolean
  /** creditLimit - outstanding, when a limit is set. */
  available?: number
}

export function summarizeCard(
  card: CreditCard,
  expenses: Expense[],
  payments: CardPayment[],
  todayIso: string
): CardSummary {
  const charges = expenses.filter((e) => isCardCharge(e, card.creditCardId))
  const paid = payments
    .filter((p) => p.creditCardId === card.creditCardId && p.status === 'confirmed')
    .reduce((s, p) => s + p.amount, 0)
  const totalCharged = charges.reduce((s, e) => s + e.amount, 0)

  const currentCycle = getStatementCycle(todayIso, card.statementDay)
  const lastStatement = getPreviousCycle(todayIso, card.statementDay)
  const unbilled = round2(sumRange(charges, currentCycle))
  const outstanding = round2(totalCharged - paid)
  const statementDue = Math.max(0, round2(outstanding - unbilled))
  const dueDate = getDueDate(lastStatement.end, card.statementDay, card.dueDay)

  return {
    card,
    outstanding,
    unbilled,
    currentCycle,
    statementDue,
    lastStatement,
    lastStatementAmount: round2(sumRange(charges, lastStatement)),
    dueDate,
    overdue: statementDue > 0 && todayIso > dueDate,
    available: card.creditLimit !== undefined ? round2(card.creditLimit - outstanding) : undefined
  }
}

export interface RangeSummary {
  from: string
  to: string
  total: number
  count: number
  byCard: { creditCardId: string; total: number }[]
  byCategory: { categoryId: string; total: number }[]
  /** Matching charges, oldest first. */
  items: Expense[]
}

/**
 * Card spending between two dates (inclusive), optionally for a single card. The range may span
 * any number of weeks/months/statement cycles; `from`/`to` are swapped if given the wrong way round.
 */
export function summarizeCardRange(
  expenses: Expense[],
  range: { from: string; to: string; creditCardId?: string }
): RangeSummary {
  const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from]
  const items = expenses
    .filter(
      (e) =>
        e.creditCardId &&
        (!range.creditCardId || e.creditCardId === range.creditCardId) &&
        isCardCharge(e, e.creditCardId) &&
        e.expenseDate >= from &&
        e.expenseDate <= to
    )
    .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate))

  const byCard = new Map<string, number>()
  const byCategory = new Map<string, number>()
  for (const e of items) {
    byCard.set(e.creditCardId!, (byCard.get(e.creditCardId!) ?? 0) + e.amount)
    byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amount)
  }
  const toList = <K extends string>(m: Map<string, number>, key: K) =>
    [...m.entries()].map(([id, total]) => ({ [key]: id, total: round2(total) }) as { [P in K]: string } & { total: number })

  return {
    from,
    to,
    total: round2(items.reduce((s, e) => s + e.amount, 0)),
    count: items.length,
    byCard: toList(byCard, 'creditCardId'),
    byCategory: toList(byCategory, 'categoryId'),
    items
  }
}
