import { AppError } from '@/shared/types/errors'
import { fromMinorUnits, toMinorUnits } from '@/shared/formatting/money'
import type { Expense, ExpenseAllocation, Settlement, WeekSettlement } from '@/domain/entities/types'

export interface NetBalance {
  memberId: string
  /** Positive = the household owes this member money; negative = this member owes the household. */
  netAmount: number
}

export interface SuggestedTransfer {
  fromMemberId: string
  toMemberId: string
  amount: number
}

/**
 * A week marked "เคลียร์ยอด" (see WeeklySummaryCard/weekSettlementService) is reconciled — its
 * expenses must drop out of the running "ยอดคงเหลือของแต่ละคน" balance automatically, so clearing
 * a week is the only action needed and no one has to also record a matching settlement transfer
 * by hand. Only 'cleared' (non-voided) rows count; a wrongly-cleared week that's been undone
 * brings its expenses back into the balance on the next read.
 */
export function excludeExpensesInClearedWeeks<T extends { expenseDate: string }>(
  expenses: T[],
  weekSettlements: Pick<WeekSettlement, 'weekStart' | 'weekEnd' | 'status'>[]
): T[] {
  const clearedRanges = weekSettlements.filter((w) => w.status === 'cleared')
  if (clearedRanges.length === 0) return expenses
  return expenses.filter(
    (e) => !clearedRanges.some((w) => e.expenseDate >= w.weekStart && e.expenseDate <= w.weekEnd)
  )
}

const RECONCILIATION_TOLERANCE_MINOR = 1 // allow at most 1 minor unit of rounding drift (BR-011)

/**
 * FR-007 Settlement: net balance = amount actually paid − amount the member is responsible for,
 * adjusted by confirmed settlements already recorded. Only 'active' (non-draft/voided/deleted)
 * expenses are counted, per BR-010.
 */
export function computeNetBalances(
  currency: string,
  expenses: Expense[],
  allocations: ExpenseAllocation[],
  settlements: Settlement[]
): NetBalance[] {
  const balanceMinor = new Map<string, number>()
  const add = (memberId: string, deltaMinor: number) => {
    balanceMinor.set(memberId, (balanceMinor.get(memberId) ?? 0) + deltaMinor)
  }

  const activeExpenses = expenses.filter((e) => e.status === 'active' && !e.deletedAt)
  const activeExpenseIds = new Set(activeExpenses.map((e) => e.expenseId))

  for (const expense of activeExpenses) {
    add(expense.paidByMemberId, toMinorUnits(expense.amount, currency))
  }
  for (const allocation of allocations) {
    if (!activeExpenseIds.has(allocation.expenseId)) continue
    add(allocation.memberId, -toMinorUnits(allocation.allocatedAmount, currency))
  }
  for (const settlement of settlements) {
    if (settlement.status !== 'confirmed') continue
    const amountMinor = toMinorUnits(settlement.amount, currency)
    // Paying member's debt decreases (their balance moves toward zero / positive).
    add(settlement.fromMemberId, amountMinor)
    add(settlement.toMemberId, -amountMinor)
  }

  const sum = [...balanceMinor.values()].reduce((a, b) => a + b, 0)
  if (Math.abs(sum) > RECONCILIATION_TOLERANCE_MINOR) {
    throw new AppError(
      'RECONCILIATION_ERROR',
      'ยอดเคลียร์ไม่สมดุล กรุณาตรวจสอบรายการปรับปรุง'
    )
  }

  return [...balanceMinor.entries()].map(([memberId, minor]) => ({
    memberId,
    netAmount: fromMinorUnits(minor, currency)
  }))
}

/**
 * Greedy debt-simplification: repeatedly matches the largest creditor with the largest debtor.
 * Minimizes the number of suggested transfers (spec open question 6 resolved toward "optimize").
 */
export function computeSuggestedTransfers(currency: string, balances: NetBalance[]): SuggestedTransfer[] {
  const creditors = balances
    .filter((b) => toMinorUnits(b.netAmount, currency) > 0)
    .map((b) => ({ memberId: b.memberId, minor: toMinorUnits(b.netAmount, currency) }))
    .sort((a, b) => b.minor - a.minor)
  const debtors = balances
    .filter((b) => toMinorUnits(b.netAmount, currency) < 0)
    .map((b) => ({ memberId: b.memberId, minor: -toMinorUnits(b.netAmount, currency) }))
    .sort((a, b) => b.minor - a.minor)

  const transfers: SuggestedTransfer[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]
    const amountMinor = Math.min(creditor.minor, debtor.minor)
    if (amountMinor > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: fromMinorUnits(amountMinor, currency)
      })
    }
    creditor.minor -= amountMinor
    debtor.minor -= amountMinor
    if (creditor.minor === 0) ci++
    if (debtor.minor === 0) di++
  }
  return transfers
}
