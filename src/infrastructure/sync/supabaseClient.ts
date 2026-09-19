import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP_CONFIG } from '@/shared/constants/config'

/**
 * Single Supabase client instance. `null` when no project is configured (VITE_SUPABASE_URL
 * unset) — every caller must handle that case, since the app must keep working standalone
 * (local-only) without a Supabase project, per the original Phase 1 design.
 */
export const supabase: SupabaseClient | null =
  APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey
    ? createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey)
    : null
