import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { pushMerchantRule } from '@/infrastructure/sync/syncEngine'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { APP_CONFIG } from '@/shared/constants/config'
import type { MerchantRule } from '@/domain/entities/types'

export interface MerchantRuleInput {
  keyword: string
  description?: string
  categoryId: string
}

function validate(input: MerchantRuleInput): void {
  if (!input.keyword.trim()) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุคำที่ใช้ค้นหาชื่อร้าน')
  if (!input.categoryId) throw new AppError('VALIDATION_ERROR', 'กรุณาเลือกหมวดหมู่')
}

/** Creates a rule, or updates the existing one with the same keyword (case-insensitive) — the
 * master list never holds two rules for one keyword. */
export async function saveMerchantRule(householdId: string, input: MerchantRuleInput): Promise<MerchantRule> {
  validate(input)
  const keyword = input.keyword.trim()
  const saved = await db.transaction('rw', db.merchantRules, db.auditLogs, async () => {
    const all = await db.merchantRules.where('householdId').equals(householdId).toArray()
    const existing = all.find((r) => r.keyword.trim().toLowerCase() === keyword.toLowerCase())
    const now = nowIso()
    const rule: MerchantRule = existing
      ? {
          ...existing,
          description: input.description?.trim() || undefined,
          categoryId: input.categoryId,
          status: 'active',
          updatedAt: now
        }
      : {
          merchantRuleId: uuidv4(),
          householdId,
          keyword,
          description: input.description?.trim() || undefined,
          categoryId: input.categoryId,
          status: 'active',
          createdAt: now,
          updatedAt: now
        }
    await db.merchantRules.put(rule)
    await recordAudit(db.auditLogs, {
      householdId,
      entityType: 'merchant_rule',
      entityId: rule.merchantRuleId,
      action: existing ? 'update_merchant_rule' : 'create_merchant_rule',
      details: { keyword, categoryId: rule.categoryId }
    })
    return rule
  })
  if (APP_CONFIG.syncEnabled) void pushMerchantRule(saved)
  return saved
}

export async function updateMerchantRule(merchantRuleId: string, patch: Partial<MerchantRuleInput>): Promise<void> {
  const updated = await db.transaction('rw', db.merchantRules, db.auditLogs, async () => {
    const existing = await db.merchantRules.get(merchantRuleId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบกฎ')
    const next: MerchantRule = {
      ...existing,
      keyword: patch.keyword?.trim() || existing.keyword,
      description: patch.description !== undefined ? patch.description.trim() || undefined : existing.description,
      categoryId: patch.categoryId ?? existing.categoryId,
      updatedAt: nowIso()
    }
    await db.merchantRules.put(next)
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'merchant_rule',
      entityId: merchantRuleId,
      action: 'update_merchant_rule',
      details: { keyword: next.keyword }
    })
    return next
  })
  if (APP_CONFIG.syncEnabled) void pushMerchantRule(updated)
}

/** Rules are never hard-deleted (sync cannot propagate deletes): switch off instead. */
export async function setMerchantRuleActive(merchantRuleId: string, active: boolean): Promise<void> {
  const updated = await db.transaction('rw', db.merchantRules, async () => {
    const existing = await db.merchantRules.get(merchantRuleId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบกฎ')
    const next: MerchantRule = { ...existing, status: active ? 'active' : 'inactive', updatedAt: nowIso() }
    await db.merchantRules.put(next)
    return next
  })
  if (APP_CONFIG.syncEnabled) void pushMerchantRule(updated)
}
