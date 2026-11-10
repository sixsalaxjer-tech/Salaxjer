import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/infrastructure/db/db'
import { summarizeCard, type CardSummary } from '@/domain/rules/creditCard'
import { todayIso } from '@/shared/formatting/date'
import type { CardPayment } from '@/domain/entities/types'

export interface CardsData {
  summaries: CardSummary[]
  payments: CardPayment[]
}

/** Live per-card billing summaries (active and inactive cards; callers filter as needed). */
export function useCardSummaries(householdId: string | undefined): CardsData | undefined {
  return useLiveQuery(async () => {
    if (!householdId) return { summaries: [], payments: [] }
    const [cards, payments] = await Promise.all([
      db.creditCards.where('householdId').equals(householdId).toArray(),
      db.cardPayments.where('householdId').equals(householdId).toArray()
    ])
    const cardIds = cards.map((c) => c.creditCardId)
    const expenses = cardIds.length ? await db.expenses.where('creditCardId').anyOf(cardIds).toArray() : []
    const today = todayIso()
    return {
      summaries: cards.map((c) => summarizeCard(c, expenses, payments, today)),
      payments
    }
  }, [householdId])
}
