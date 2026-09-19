import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { APP_CONFIG } from '@/shared/constants/config'
import type { Member, MemberRole } from '@/domain/entities/types'

export interface MemberInput {
  displayName: string
  role: MemberRole
  color: string
}

async function assertNameUnique(householdId: string, name: string, excludeId?: string): Promise<void> {
  const normalized = name.trim().toLowerCase()
  const existing = await db.members.where('householdId').equals(householdId).toArray()
  const clash = existing.some(
    (m) => m.memberId !== excludeId && m.displayName.trim().toLowerCase() === normalized
  )
  if (clash) throw new AppError('VALIDATION_ERROR', 'ชื่อสมาชิกนี้มีอยู่แล้ว')
}

export async function addMember(householdId: string, input: MemberInput): Promise<Member> {
  if (!input.displayName.trim()) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อสมาชิก')
  }
  const now = nowIso()
  const member: Member = {
    memberId: uuidv4(),
    householdId,
    displayName: input.displayName.trim(),
    role: input.role,
    color: input.color,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  await db.transaction('rw', db.members, db.auditLogs, async () => {
    await assertNameUnique(householdId, member.displayName)
    const count = await db.members.where('householdId').equals(householdId).count()
    if (count >= APP_CONFIG.maxMembersPerHousehold) {
      throw new AppError(
        'VALIDATION_ERROR',
        `จำนวนสมาชิกเกินกำหนด (สูงสุด ${APP_CONFIG.maxMembersPerHousehold} คน)`
      )
    }
    await db.members.add(member)
    await recordAudit(db.auditLogs, {
      householdId,
      entityType: 'member',
      entityId: member.memberId,
      action: 'create_member',
      details: { displayName: member.displayName }
    })
  })
  return member
}

export async function updateMember(memberId: string, patch: Partial<MemberInput>): Promise<void> {
  await db.transaction('rw', db.members, db.auditLogs, async () => {
    const existing = await db.members.get(memberId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบสมาชิก')
    const displayName = (patch.displayName ?? existing.displayName).trim()
    if (!displayName) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อสมาชิก')
    await assertNameUnique(existing.householdId, displayName, memberId)
    await db.members.put({ ...existing, ...patch, displayName, updatedAt: nowIso() })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'member',
      entityId: memberId,
      action: 'update_member',
      details: { patch }
    })
  })
}

/** FR-002: members referenced by existing expenses must not be hard-deleted, only deactivated. */
export async function deactivateMember(memberId: string): Promise<void> {
  await db.transaction('rw', db.members, db.auditLogs, async () => {
    const existing = await db.members.get(memberId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบสมาชิก')
    await db.members.put({ ...existing, status: 'inactive', updatedAt: nowIso() })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'member',
      entityId: memberId,
      action: 'deactivate_member',
      details: {}
    })
  })
}
