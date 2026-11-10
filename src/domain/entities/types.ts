// Domain entity types — logical model per spec section 13.2.
// Field names are camelCase equivalents of the spec's logical fields.

export type SyncStatus =
  | 'local_only'
  | 'pending_sync'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error'
  | 'dead_letter'

export type ExpenseStatus = 'draft' | 'active' | 'voided'

/** Personal/Shared/Advance are the primary MVP types; Household/Income/Adjustment extend the model per spec section 9. */
export type ExpenseType = 'personal' | 'shared' | 'advance' | 'household' | 'income' | 'adjustment'

export type AllocationType = 'equal' | 'exact' | 'percentage'

export type MemberRole = 'admin' | 'member' | 'viewer'

export type MemberStatus = 'active' | 'inactive'

export type CategoryStatus = 'active' | 'inactive'

export type SettlementStatus = 'draft' | 'confirmed' | 'voided'

export type WeekSettlementStatus = 'cleared' | 'voided'

export type AuditAction =
  | 'create_expense'
  | 'update_expense'
  | 'void_expense'
  | 'create_settlement'
  | 'confirm_settlement'
  | 'void_settlement'
  | 'clear_week_settlement'
  | 'void_week_settlement'
  | 'create_household'
  | 'update_household'
  | 'create_member'
  | 'update_member'
  | 'deactivate_member'
  | 'create_category'
  | 'update_category'
  | 'deactivate_category'
  | 'reactivate_category'
  | 'create_credit_card'
  | 'update_credit_card'
  | 'deactivate_credit_card'
  | 'reactivate_credit_card'
  | 'create_card_payment'
  | 'void_card_payment'
  | 'create_merchant_rule'
  | 'update_merchant_rule'
  | 'import_restore'
  | 'export_backup'
  | 'conflict_resolution'

export interface Household {
  householdId: string
  name: string
  baseCurrency: string
  monthStartDay: number
  createdAt: string
  updatedAt: string
  version: number
  /** Only present when the household is backed by Supabase (see supabase/schema.sql). Lets a
   * second device join the same household — see Settings > Household. */
  inviteCode?: string
}

export interface Member {
  memberId: string
  householdId: string
  displayName: string
  role: MemberRole
  color: string
  status: MemberStatus
  createdAt: string
  updatedAt: string
}

export interface Category {
  categoryId: string
  householdId: string
  name: string
  icon: string
  color: string
  isDefault: boolean
  status: CategoryStatus
  createdAt: string
  updatedAt: string
}

export interface Expense {
  expenseId: string
  householdId: string
  expenseDate: string // ISO date (yyyy-MM-dd)
  amount: number
  currency: string
  categoryId: string
  paidByMemberId: string
  expenseType: ExpenseType
  description: string
  tags: string[]
  status: ExpenseStatus
  syncStatus: SyncStatus
  clientUpdatedAt: string
  serverUpdatedAt?: string
  version: number
  deletedAt?: string
  idempotencyKey: string
  /** Reason is required when expenseType === 'adjustment' per BR-002. */
  adjustmentReason?: string
  /** Set when the expense was charged to a credit card (see CreditCard). Local-only for now:
   * not carried by the cloud sync mappers. */
  creditCardId?: string
}

export type CreditCardStatus = 'active' | 'inactive'

export interface CreditCard {
  creditCardId: string
  householdId: string
  name: string
  /** Last 4 digits, for telling cards apart. Optional; never store the full number. */
  last4?: string
  ownerMemberId?: string
  /** Day of month the statement closes (1-31; clamped to the month's length). */
  statementDay: number
  /** Day of month the payment is due (1-31; clamped). Falls in the month after statementDay if <= statementDay. */
  dueDay: number
  creditLimit?: number
  color: string
  status: CreditCardStatus
  createdAt: string
  updatedAt: string
}

export type MerchantRuleStatus = 'active' | 'inactive'

/** Master list that classifies card merchants: a notification/statement merchant containing
 * `keyword` (case-insensitive) is given `categoryId` and, if set, a friendlier `description`.
 * When several keywords match, the longest (most specific) wins. */
export interface MerchantRule {
  merchantRuleId: string
  householdId: string
  keyword: string
  description?: string
  categoryId: string
  status: MerchantRuleStatus
  createdAt: string
  updatedAt: string
}

export type CardPaymentStatus = 'confirmed' | 'voided'

/** A repayment of the card bill. Reduces the card's outstanding balance. */
export interface CardPayment {
  cardPaymentId: string
  householdId: string
  creditCardId: string
  amount: number
  paymentDate: string
  note?: string
  status: CardPaymentStatus
  createdAt: string
  updatedAt: string
}

export interface ExpenseAllocation {
  allocationId: string
  expenseId: string
  memberId: string
  allocationType: AllocationType
  percentage?: number
  allocatedAmount: number
}

export interface Attachment {
  attachmentId: string
  expenseId: string
  fileName: string
  mimeType: string
  fileSize: number
  blob: Blob
  checksum: string
  createdAt: string
}

export interface Settlement {
  settlementId: string
  householdId: string
  fromMemberId: string
  toMemberId: string
  amount: number
  settlementDate: string
  status: SettlementStatus
  proofAttachmentId?: string
  note?: string
  createdAt: string
  updatedAt: string
}

/**
 * Marks a week's total (as shown on the weekly text-share card, WeeklySummaryCard) as
 * cleared/settled among the household — a lightweight reconciliation flag, not a per-member
 * debt transfer (see Settlement for that). At most one active ('cleared') row per
 * householdId+weekStart; clearing again after a void creates a fresh row rather than reviving
 * the old one, matching the never-hard-delete pattern used elsewhere (BR-006/FR-002).
 */
export interface WeekSettlement {
  weekSettlementId: string
  householdId: string
  weekStart: string // ISO date (Monday)
  weekEnd: string // ISO date (Sunday)
  total: number // snapshot of that week's total at the moment it was cleared — never typed by hand
  status: WeekSettlementStatus
  clearedAt: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  auditLogId: string
  householdId: string
  entityType: string
  entityId: string
  action: AuditAction
  actorMemberId?: string
  timestamp: string
  details: Record<string, unknown>
}

export type SyncOperation = 'create' | 'update' | 'delete'
export type SyncQueueStatus = 'pending' | 'processing' | 'completed' | 'error' | 'dead_letter'

export interface SyncQueueEntry {
  queueId: string
  entityType: string
  entityId: string
  operation: SyncOperation
  payload: string // JSON-serialized payload
  idempotencyKey: string
  retryCount: number
  nextRetryAt?: string
  status: SyncQueueStatus
  lastError?: string
}

export interface AppMeta {
  key: string
  value: string
}

export interface RestorePoint {
  restorePointId: string
  createdAt: string
  snapshotJson: string
}
