import { db } from '@/infrastructure/db/db'
import { getMonthRange } from '@/shared/formatting/date'
import type { Expense } from '@/domain/entities/types'

export interface CategoryTotal {
  categoryId: string
  total: number
}

export interface MemberTotal {
  memberId: string
  total: number
}

export interface DashboardSummary {
  rangeStart: string
  rangeEnd: string
  totalThisPeriod: number
  totalPreviousPeriod: number
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
  recent: Expense[]
}

/** BR-010: Dashboard must never count draft, voided, or soft-deleted expenses. */
function isReconcilable(e: Expense): boolean {
  return e.status === 'active' && !e.deletedAt
}

function sumInRange(expenses: Expense[], start: string, end: string): number {
  return expenses
    .filter((e) => e.expenseDate >= start && e.expenseDate <= end)
    .reduce((sum, e) => sum + e.amount, 0)
}

/** FR-006 Dashboard: totals reconcile with the Transactions list under the same filters (NFR-004). */
export async function getDashboardSummary(
  householdId: string,
  monthStartDay: number,
  asOfDateIso: string
): Promise<DashboardSummary> {
  const all = (await db.expenses.where('householdId').equals(householdId).toArray()).filter(isReconcilable)

  const [rangeStart, rangeEnd] = getMonthRange(asOfDateIso, monthStartDay)
  const prevAnchor = new Date(rangeStart + 'T00:00:00')
  prevAnchor.setDate(prevAnchor.getDate() - 1)
  const [prevStart, prevEnd] = getMonthRange(prevAnchor.toISOString().slice(0, 10), monthStartDay)

  const inRange = all.filter((e) => e.expenseDate >= rangeStart && e.expenseDate <= rangeEnd)

  const byCategoryMap = new Map<string, number>()
  const byMemberMap = new Map<string, number>()
  for (const e of inRange) {
    byCategoryMap.set(e.categoryId, (byCategoryMap.get(e.categoryId) ?? 0) + e.amount)
    byMemberMap.set(e.paidByMemberId, (byMemberMap.get(e.paidByMemberId) ?? 0) + e.amount)
  }

  const recent = [...all].sort((a, b) => (a.clientUpdatedAt < b.clientUpdatedAt ? 1 : -1)).slice(0, 10)

  return {
    rangeStart,
    rangeEnd,
    totalThisPeriod: sumInRange(all, rangeStart, rangeEnd),
    totalPreviousPeriod: sumInRange(all, prevStart, prevEnd),
    byCategory: [...byCategoryMap.entries()].map(([categoryId, total]) => ({ categoryId, total })),
    byMember: [...byMemberMap.entries()].map(([memberId, total]) => ({ memberId, total })),
    recent
  }
}

export interface PeriodBreakdown {
  rangeStart: string
  rangeEnd: string
  total: number
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
}

/** Same reconciliation rule as getDashboardSummary (BR-010), for an arbitrary date range —
 * used by the weekly text-summary feature (features/dashboard/WeeklySummaryCard.tsx). */
export async function getPeriodBreakdown(
  householdId: string,
  startIso: string,
  endIso: string
): Promise<PeriodBreakdown> {
  const all = (await db.expenses.where('householdId').equals(householdId).toArray()).filter(isReconcilable)
  const inRange = all.filter((e) => e.expenseDate >= startIso && e.expenseDate <= endIso)

  const byCategoryMap = new Map<string, number>()
  const byMemberMap = new Map<string, number>()
  for (const e of inRange) {
    byCategoryMap.set(e.categoryId, (byCategoryMap.get(e.categoryId) ?? 0) + e.amount)
    byMemberMap.set(e.paidByMemberId, (byMemberMap.get(e.paidByMemberId) ?? 0) + e.amount)
  }

  return {
    rangeStart: startIso,
    rangeEnd: endIso,
    total: sumInRange(all, startIso, endIso),
    byCategory: [...byCategoryMap.entries()].map(([categoryId, total]) => ({ categoryId, total })),
    byMember: [...byMemberMap.entries()].map(([memberId, total]) => ({ memberId, total }))
  }
}
