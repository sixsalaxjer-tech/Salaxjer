// Central application configuration.
// Values marked TO_CONFIRM come from family-expense-pwa-offline-spec.md section 7 (To Be Confirmed)
// and MUST be revisited before a production release. They are read from environment variables so
// they can be adjusted without code changes, with safe MVP defaults.

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === 'true' || value === '1'
}

function readNumber(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const APP_CONFIG = {
  /** TO_CONFIRM: APP_NAME */
  appName: import.meta.env.VITE_APP_NAME ?? 'Family Expense PWA',

  /** TO_CONFIRM: สกุลเงินหลัก — default currency offered when creating a new Household. */
  defaultCurrency: import.meta.env.VITE_DEFAULT_CURRENCY ?? 'THB',

  /** TO_CONFIRM: จำนวนสมาชิกสูงสุดต่อ Household */
  maxMembersPerHousehold: readNumber(import.meta.env.VITE_MAX_MEMBERS_PER_HOUSEHOLD, 20),

  /**
   * TO_CONFIRM: ต้อง Login หรือใช้ Local Profile เท่านั้น
   * Resolved by request: real accounts (Supabase Auth) so two household members can see each
   * other's entries live. Falls back to the original local-device-owner MVP mode when no
   * Supabase project is configured (VITE_SUPABASE_URL unset), so the app still works standalone.
   */
  authMode: import.meta.env.VITE_SUPABASE_URL ? ('supabase' as const) : ('local_device_owner' as const),

  /** Supabase project — see supabase/schema.sql for the backing tables/RLS/RPCs. */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',

  /**
   * Login is username + password only (no email) — see src/features/auth/syntheticEmail.ts.
   * This fixed domain is only ever used to shape a syntactically-valid Supabase Auth identifier
   * locally; it must never receive real mail (requires "Confirm email" off in the Supabase
   * project, see docs/CLOUD_SYNC.md).
   */
  authUsernameDomain: import.meta.env.VITE_AUTH_USERNAME_DOMAIN ?? 'users.sixsalaxjer-tech.github.io',

  /** Cross-device sync (Phase 3): on by default once a Supabase project is configured. */
  syncEnabled: readBool(import.meta.env.VITE_SYNC_ENABLED, Boolean(import.meta.env.VITE_SUPABASE_URL)),

  /** TO_CONFIRM: ต้องเข้ารหัสฐานข้อมูล Local หรือไม่ — whole-DB encryption is out of scope for Phase 1. */
  encryptLocalDb: readBool(import.meta.env.VITE_ENCRYPT_LOCAL_DB, false),

  /** TO_CONFIRM: ขนาดไฟล์หลักฐานสูงสุด — reserved for Phase 2 attachment upload. */
  maxAttachmentSizeMb: readNumber(import.meta.env.VITE_MAX_ATTACHMENT_SIZE_MB, 5),

  storageWarningThresholdPercent: readNumber(
    import.meta.env.VITE_STORAGE_WARNING_THRESHOLD_PERCENT,
    80
  )
} as const
