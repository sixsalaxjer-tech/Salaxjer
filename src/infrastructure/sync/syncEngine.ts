import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/sync/supabaseClient'
import { db } from '@/infrastructure/db/db'
import { logger } from '@/infrastructure/logging/logger'
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

/**
 * Cross-device sync (Phase 3), built on top of the offline-first Dexie layer rather than
 * replacing it: every write still lands in IndexedDB first (so the app keeps working offline,
 * per NFR-001), and this module is a best-effort bridge that pushes local writes up to Supabase
 * and pulls other devices' writes back down into the same local tables. Because writes land in
 * Dexie either way, `useLiveQuery` screens re-render automatically on both local and
 * synced-in-from-elsewhere changes — no UI code needs to know sync exists.
 */

function isEnabled(): boolean {
  return supabase !== null
}

/**
 * Never throws: sync is best-effort on top of a local write that has already succeeded. A
 * network failure here (e.g. offline) just leaves the row's syncStatus as-is, to be retried by
 * catchUpPendingPushes next time the app is online.
 */
async function safeUpsert(table: string, rows: unknown[]): Promise<boolean> {
  if (!supabase || rows.length === 0) return false
  try {
    const { error } = await supabase.from(table).upsert(rows)
    if (error) {
      logger.log(`sync:push:${table}`, 'error', { errorCode: error.code })
      return false
    }
    return true
  } catch (err) {
    logger.log(`sync:push:${table}`, 'error', { errorCode: err instanceof Error ? err.name : 'UNKNOWN' })
    return false
  }
}

export async function pushHousehold(h: Household): Promise<void> {
  await safeUpsert('households', [householdToDb(h)])
}

export async function pushMember(m: Member): Promise<void> {
  await safeUpsert('members', [memberToDb(m, m.householdId)])
}

export async function pushCategory(c: Category): Promise<void> {
  await safeUpsert('categories', [categoryToDb(c, c.householdId)])
}

export async function pushSettlement(s: Settlement): Promise<void> {
  await safeUpsert('settlements', [settlementToDb(s)])
}

export async function pushWeekSettlement(w: WeekSettlement): Promise<void> {
  await safeUpsert('week_settlements', [weekSettlementToDb(w)])
}

/** Pushes an expense and its allocations together, then marks the local row 'synced' on success. */
export async function pushExpense(expense: Expense, allocations: ExpenseAllocation[]): Promise<void> {
  if (!supabase) return
  const expenseOk = await safeUpsert('expenses', [expenseToDb(expense)])
  if (!expenseOk) return
  if (allocations.length > 0) {
    const allocOk = await safeUpsert('expense_allocations', allocations.map(allocationToDb))
    if (!allocOk) return
  }
  await db.expenses.update(expense.expenseId, { syncStatus: 'synced' })
}

/** Re-pushes any local expenses not yet confirmed synced — run on app start and on 'online'. */
export async function catchUpPendingPushes(householdId: string): Promise<void> {
  if (!isEnabled()) return
  const pending = await db.expenses
    .where('householdId')
    .equals(householdId)
    .filter((e) => e.syncStatus !== 'synced')
    .toArray()
  for (const expense of pending) {
    const allocations = await db.expenseAllocations.where('expenseId').equals(expense.expenseId).toArray()
    await pushExpense(expense, allocations)
  }
}

/** Full pull: fetches every row for the household from Supabase and upserts into Dexie. Used
 * right after login/join (local Dexie starts empty) and as a periodic reconnect catch-up. */
export async function pullAll(householdId: string): Promise<void> {
  if (!supabase) return
  try {
    const [householdRes, membersRes, categoriesRes, expensesRes, settlementsRes, weekSettlementsRes] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
      supabase.from('members').select('*').eq('household_id', householdId),
      supabase.from('categories').select('*').eq('household_id', householdId),
      supabase.from('expenses').select('*').eq('household_id', householdId),
      supabase.from('settlements').select('*').eq('household_id', householdId),
      supabase.from('week_settlements').select('*').eq('household_id', householdId)
    ])

    if (householdRes.data) await db.households.put(dbToHousehold(householdRes.data))
    if (membersRes.data) await db.members.bulkPut(membersRes.data.map(dbToMember))
    if (categoriesRes.data) await db.categories.bulkPut(categoriesRes.data.map(dbToCategory))
    if (expensesRes.data) await db.expenses.bulkPut(expensesRes.data.map(dbToExpense))
    if (settlementsRes.data) await db.settlements.bulkPut(settlementsRes.data.map(dbToSettlement))
    if (weekSettlementsRes.data) await db.weekSettlements.bulkPut(weekSettlementsRes.data.map(dbToWeekSettlement))

    const expenseIds = (expensesRes.data ?? []).map((e) => e.id as string)
    if (expenseIds.length > 0) {
      const { data: allocations } = await supabase.from('expense_allocations').select('*').in('expense_id', expenseIds)
      if (allocations) await db.expenseAllocations.bulkPut(allocations.map(dbToAllocation))
    }

    logger.log('sync:pullAll', 'success', { entityType: 'household', entityId: householdId })
  } catch (err) {
    logger.log('sync:pullAll', 'error', { errorCode: err instanceof Error ? err.name : 'UNKNOWN' })
  }
}

let realtimeChannel: RealtimeChannel | null = null

/** Subscribes to live changes from other devices for this household. RLS (supabase/schema.sql)
 * already restricts Postgres Changes broadcasts to rows the current user can see, so these
 * subscriptions can be unfiltered for the tables without a direct household_id column. */
export function startRealtimeSync(householdId: string): void {
  if (!supabase || realtimeChannel) return

  realtimeChannel = supabase
    .channel(`household:${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.expenses.put(dbToExpense(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_allocations' }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.expenseAllocations.put(dbToAllocation(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.members.put(dbToMember(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.categories.put(dbToCategory(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `household_id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.settlements.put(dbToSettlement(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'week_settlements', filter: `household_id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.weekSettlements.put(dbToWeekSettlement(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return
      void db.households.put(dbToHousehold(payload.new as Record<string, unknown>))
    })
    .subscribe()
}

export function stopRealtimeSync(): void {
  if (realtimeChannel) {
    void realtimeChannel.unsubscribe()
    realtimeChannel = null
  }
}
