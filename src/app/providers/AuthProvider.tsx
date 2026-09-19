import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/sync/supabaseClient'
import { toSyntheticEmail } from '@/features/auth/syntheticEmail'

interface AuthContextValue {
  /** false when no Supabase project is configured — the app then behaves exactly like the
   * original local-only Phase 1 build (see APP_CONFIG.authMode). */
  enabled: boolean
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  /** Returns the new session, or null if the project unexpectedly still requires confirmation
   * (see docs/CLOUD_SYNC.md — "Confirm email" should be off since usernames aren't real inboxes). */
  signUp: (username: string, password: string) => Promise<Session | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signIn(username: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithPassword({ email: toSyntheticEmail(username), password })
    if (error) throw error
  }

  async function signUp(username: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signUp({ email: toSyntheticEmail(username), password })
    if (error) throw error
    return data.session
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    enabled: supabase !== null,
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
