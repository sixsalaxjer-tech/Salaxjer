import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { db } from '@/infrastructure/db/db'
import { supabase } from '@/infrastructure/sync/supabaseClient'
import { catchUpPendingPushes, pullAll, startRealtimeSync, stopRealtimeSync } from '@/infrastructure/sync/syncEngine'
import { LoadingState } from '@/components/ui/LoadingState'
import { HouseholdSetupScreen } from '@/features/auth/HouseholdSetupScreen'

/** Removes any local household (and its members/categories/expenses/etc.) that does NOT match
 * the server-confirmed id — e.g. a household created locally before this device ever had cloud
 * sync configured, which would otherwise sit in Dexie forever and get picked by
 * `db.households.orderBy('name').first()` ahead of the real one. */
async function discardMismatchedLocalHouseholds(keepHouseholdId: string): Promise<void> {
  const stale = await db.households.where('householdId').notEqual(keepHouseholdId).toArray()
  if (stale.length === 0) return
  await db.transaction(
    'rw',
    [db.households, db.members, db.categories, db.expenses, db.expenseAllocations, db.settlements],
    async () => {
      for (const h of stale) {
        const expenseIds = await db.expenses.where('householdId').equals(h.householdId).primaryKeys()
        await db.expenseAllocations.where('expenseId').anyOf(expenseIds).delete()
        await db.expenses.where('householdId').equals(h.householdId).delete()
        await db.members.where('householdId').equals(h.householdId).delete()
        await db.categories.where('householdId').equals(h.householdId).delete()
        await db.settlements.where('householdId').equals(h.householdId).delete()
        await db.households.delete(h.householdId)
      }
    }
  )
}

/**
 * Bridges an authenticated Supabase session to the local Dexie household. A no-op passthrough
 * when Supabase isn't configured, so the original local-only Phase 1 behavior is unaffected.
 *
 * Always asks `household_members` which household this account actually belongs to — it never
 * trusts "a household exists locally" as proof that it's the *right* one, since local-only data
 * can predate cloud sync being configured on a given device/browser at all. If the local cache
 * doesn't match, mismatched local data is discarded and the correct household is pulled fresh.
 */
export function CloudSyncBootstrap({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { household, loading: householdLoading } = useHousehold()
  const [status, setStatus] = useState<'checking' | 'ready' | 'no-household'>('checking')
  const resolvedFor = useRef<{ user: string; household: string } | null>(null)

  useEffect(() => {
    if (!supabase || !user || householdLoading) return
    if (resolvedFor.current?.user === user.id && resolvedFor.current.household === household?.householdId) return

    let cancelled = false
    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data) {
          // No household linked to this account at all — any local household data predates
          // cloud sync (or belongs to a since-removed membership) and must not be shown.
          if (household) await discardMismatchedLocalHouseholds('__none__')
          setStatus('no-household')
          return
        }
        const confirmedId = data.household_id as string
        if (household?.householdId !== confirmedId) {
          await discardMismatchedLocalHouseholds(confirmedId)
          await pullAll(confirmedId)
        } else {
          void catchUpPendingPushes(confirmedId)
          void pullAll(confirmedId)
        }
        startRealtimeSync(confirmedId)
        resolvedFor.current = { user: user.id, household: confirmedId }
        setStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [user, household, householdLoading])

  useEffect(() => stopRealtimeSync, [])

  useEffect(() => {
    function onOnline() {
      if (household) {
        void catchUpPendingPushes(household.householdId)
        void pullAll(household.householdId)
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [household])

  if (!supabase || !user) return <>{children}</>
  if (status === 'no-household') return <HouseholdSetupScreen />
  if (!household || resolvedFor.current?.household !== household.householdId) {
    return <LoadingState label="กำลังซิงก์ข้อมูล..." />
  }
  return <>{children}</>
}
