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
   * MVP assumption (spec section 8 note): no login in v1 — the device owner is automatically
   * the Household Admin. This flag exists so the assumption is explicit and easy to change later.
   */
  authMode: 'local_device_owner' as const,

  /** TO_CONFIRM: ต้อง Sync ข้ามอุปกรณ์ใน Version แรกหรือไม่ — Phase 1 ships with no backend. */
  syncEnabled: readBool(import.meta.env.VITE_SYNC_ENABLED, false),

  /** TO_CONFIRM: Backend และ Hosting Platform — left blank until a backend is selected. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',

  /** TO_CONFIRM: ต้องเข้ารหัสฐานข้อมูล Local หรือไม่ — whole-DB encryption is out of scope for Phase 1. */
  encryptLocalDb: readBool(import.meta.env.VITE_ENCRYPT_LOCAL_DB, false),

  /** TO_CONFIRM: ขนาดไฟล์หลักฐานสูงสุด — reserved for Phase 2 attachment upload. */
  maxAttachmentSizeMb: readNumber(import.meta.env.VITE_MAX_ATTACHMENT_SIZE_MB, 5),

  storageWarningThresholdPercent: readNumber(
    import.meta.env.VITE_STORAGE_WARNING_THRESHOLD_PERCENT,
    80
  )
} as const
