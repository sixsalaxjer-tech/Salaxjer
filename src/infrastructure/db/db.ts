import Dexie, { type Table } from 'dexie'
import type {
  AppMeta,
  AuditLog,
  Attachment,
  Category,
  Expense,
  ExpenseAllocation,
  Household,
  Member,
  RestorePoint,
  Settlement,
  SyncQueueEntry,
  WeekSettlement
} from '@/domain/entities/types'

/**
 * Local database schema — see docs/DATABASE_SCHEMA.md for the full field-by-field reference
 * and the migration history. `SCHEMA_VERSION` must be bumped whenever a `db.version(n)` block
 * is added below, and the two must always match (enforced by a dev-time assertion in main.tsx).
 *
 * Migration pattern for future changes:
 *   this.version(2).stores({ ...same as v1, newTable: 'id, indexedField' }).upgrade(tx => { ... })
 * Dexie only re-runs `.upgrade()` for versions newer than what is already on disk, so existing
 * user data is preserved automatically (NFR-008 Recoverability).
 */
export const SCHEMA_VERSION = 2

export class AppDatabase extends Dexie {
  households!: Table<Household, string>
  members!: Table<Member, string>
  categories!: Table<Category, string>
  expenses!: Table<Expense, string>
  expenseAllocations!: Table<ExpenseAllocation, string>
  attachments!: Table<Attachment, string>
  settlements!: Table<Settlement, string>
  weekSettlements!: Table<WeekSettlement, string>
  auditLogs!: Table<AuditLog, string>
  syncQueue!: Table<SyncQueueEntry, string>
  appMeta!: Table<AppMeta, string>
  restorePoints!: Table<RestorePoint, string>

  constructor() {
    super('FamilyExpensePWA')

    this.version(1).stores({
      households: 'householdId, name',
      members: 'memberId, householdId, [householdId+status], displayName',
      categories: 'categoryId, householdId, [householdId+status], name',
      expenses:
        'expenseId, householdId, [householdId+expenseDate], [householdId+status], categoryId, paidByMemberId, expenseType, status, syncStatus, idempotencyKey, deletedAt',
      expenseAllocations: 'allocationId, expenseId, memberId',
      attachments: 'attachmentId, expenseId',
      settlements: 'settlementId, householdId, fromMemberId, toMemberId, settlementDate, status',
      auditLogs: 'auditLogId, householdId, entityType, entityId, timestamp',
      syncQueue: 'queueId, entityType, entityId, status, idempotencyKey',
      appMeta: 'key',
      restorePoints: 'restorePointId, createdAt'
    })

    this.version(SCHEMA_VERSION).stores({
      households: 'householdId, name',
      members: 'memberId, householdId, [householdId+status], displayName',
      categories: 'categoryId, householdId, [householdId+status], name',
      expenses:
        'expenseId, householdId, [householdId+expenseDate], [householdId+status], categoryId, paidByMemberId, expenseType, status, syncStatus, idempotencyKey, deletedAt',
      expenseAllocations: 'allocationId, expenseId, memberId',
      attachments: 'attachmentId, expenseId',
      settlements: 'settlementId, householdId, fromMemberId, toMemberId, settlementDate, status',
      weekSettlements: 'weekSettlementId, householdId, [householdId+weekStart], status',
      auditLogs: 'auditLogId, householdId, entityType, entityId, timestamp',
      syncQueue: 'queueId, entityType, entityId, status, idempotencyKey',
      appMeta: 'key',
      restorePoints: 'restorePointId, createdAt'
    })
  }
}

export const db = new AppDatabase()

/** All table names, used by backup/restore to iterate the whole database generically. */
export const ALL_TABLE_NAMES = [
  'households',
  'members',
  'categories',
  'expenses',
  'expenseAllocations',
  'settlements',
  'weekSettlements',
  'auditLogs'
] as const

export type BackupTableName = (typeof ALL_TABLE_NAMES)[number]
