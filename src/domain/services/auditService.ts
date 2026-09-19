import { v4 as uuidv4 } from 'uuid'
import type { Table } from 'dexie'
import { nowIso } from '@/shared/formatting/date'
import type { AuditAction, AuditLog } from '@/domain/entities/types'

export interface RecordAuditInput {
  householdId: string
  entityType: string
  entityId: string
  action: AuditAction
  actorMemberId?: string
  details?: Record<string, unknown>
}

/**
 * Writes an audit entry using the given Dexie table handle so callers can include it inside
 * their own `db.transaction(...)` block (spec section 22, step 7 "Create Audit Log").
 * Never pass secrets/PII beyond what's already in `details` — see spec section 19.
 */
export async function recordAudit(
  auditLogs: Table<AuditLog, string>,
  input: RecordAuditInput
): Promise<void> {
  await auditLogs.add({
    auditLogId: uuidv4(),
    householdId: input.householdId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorMemberId: input.actorMemberId,
    timestamp: nowIso(),
    details: input.details ?? {}
  })
}
