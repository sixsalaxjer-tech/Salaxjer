import { db } from '@/infrastructure/db/db'
import type { Expense } from '@/domain/entities/types'

export interface DuplicateCheckInput {
  householdId: string
  expenseDate: string
  amount: number
  paidByMemberId: string
  categoryId: string
  description: string
  excludeExpenseId?: string
}

function normalizeDescription(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function descriptionsAreClose(a: string, b: string): boolean {
  const na = normalizeDescription(a)
  const nb = normalizeDescription(b)
  if (na === nb) return true
  if (na.length === 0 || nb.length === 0) return na === nb
  return na.includes(nb) || nb.includes(na)
}

/**
 * Section 17 Duplicate Handling: same household + date + amount + payer + category, with a
 * "close enough" description, is a duplicate *candidate* — the system warns but never blocks
 * automatically. Only 'active' expenses are considered.
 */
export async function findDuplicateCandidates(input: DuplicateCheckInput): Promise<Expense[]> {
  const candidates = await db.expenses
    .where('[householdId+expenseDate]')
    .equals([input.householdId, input.expenseDate])
    .filter(
      (e) =>
        e.status === 'active' &&
        !e.deletedAt &&
        e.expenseId !== input.excludeExpenseId &&
        e.paidByMemberId === input.paidByMemberId &&
        e.categoryId === input.categoryId &&
        e.amount === input.amount &&
        descriptionsAreClose(e.description, input.description)
    )
    .toArray()
  return candidates
}
