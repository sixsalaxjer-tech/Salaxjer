import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { supabase } from '@/infrastructure/sync/supabaseClient'
import { catchUpPendingPushes, pullAll, startRealtimeSync, stopRealtimeSync } from '@/infrastructure/sync/syncEngine'
import { LoadingState } from '@/components/ui/LoadingState'
import { HouseholdSetupScreen } from '@/features/auth/HouseholdSetupScreen'

/**
 * Bridges an authenticated Supabase session to the local Dexie household. A no-op passthrough
 * when Supabase isn't configured, so the original local-only Phase 1 behavior is unaffected.
 *
 * On a device that already has the household locally (the common case), this just starts
 * realtime sync and re-pushes anything not yet confirmed synced. On a brand-new device logging
 * into the (single, shared) account for the first time ever, local Dexie is empty and no
 * household exists yet anywhere, so this shows the one-time HouseholdSetupScreen instead of the
 * rest of the app.
 */
export function CloudSyncBootstrap({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { household, loading: householdLoading } = useHousehold()
  const [status, setStatus] = useState<'checking' | 'ready' | 'no-household'>('checking')
  const startedRealtimeFor = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase || !user || householdLoading) return

    if (household) {
      if (startedRealtimeFor.current !== household.householdId) {
        startedRealtimeFor.current = household.householdId
        startRealtimeSync(household.householdId)
        void catchUpPendingPushes(household.householdId)
        void pullAll(household.householdId)
      }
      setStatus('ready')
      return
    }

    let cancelled = false
    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data) {
          setStatus('no-household')
          return
        }
        await pullAll(data.household_id as string)
        startRealtimeSync(data.household_id as string)
        startedRealtimeFor.current = data.household_id as string
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
  if (!household && status === 'checking') return <LoadingState label="กำลังซิงก์ข้อมูล..." />
  if (!household && status === 'no-household') return <HouseholdSetupScreen />
  return <>{children}</>
}
