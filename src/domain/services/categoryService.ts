import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { pushCategory } from '@/infrastructure/sync/syncEngine'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { APP_CONFIG } from '@/shared/constants/config'
import type { Category } from '@/domain/entities/types'

export const DEFAULT_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: 'อาหาร', icon: '🍜', color: '#f97316' },
  { name: 'ที่พัก/สาธารณูปโภค', icon: '🏠', color: '#0ea5e9' },
  { name: 'เดินทาง', icon: '🚗', color: '#6366f1' },
  { name: 'ของใช้ส่วนตัว', icon: '🧴', color: '#ec4899' },
  { name: 'สุขภาพ', icon: '💊', color: '#22c55e' },
  { name: 'การศึกษา', icon: '📚', color: '#a855f7' },
  { name: 'บันเทิง', icon: '🎬', color: '#eab308' },
  { name: 'อื่นๆ', icon: '📦', color: '#64748b' }
]

export interface CategoryInput {
  name: string
  icon: string
  color: string
}

async function assertNameUnique(householdId: string, name: string, excludeId?: string): Promise<void> {
  const normalized = name.trim().toLowerCase()
  const existing = await db.categories.where('householdId').equals(householdId).toArray()
  const clash = existing.some(
    (c) => c.categoryId !== excludeId && c.name.trim().toLowerCase() === normalized
  )
  if (clash) throw new AppError('VALIDATION_ERROR', 'ชื่อหมวดหมู่นี้มีอยู่แล้ว')
}

export async function addCategory(householdId: string, input: CategoryInput): Promise<Category> {
  if (!input.name.trim()) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อหมวดหมู่')
  const now = nowIso()
  const category: Category = {
    categoryId: uuidv4(),
    householdId,
    name: input.name.trim(),
    icon: input.icon || '📦',
    color: input.color || '#64748b',
    isDefault: false,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  await db.transaction('rw', db.categories, db.auditLogs, async () => {
    await assertNameUnique(householdId, category.name)
    await db.categories.add(category)
    await recordAudit(db.auditLogs, {
      householdId,
      entityType: 'category',
      entityId: category.categoryId,
      action: 'create_category',
      details: { name: category.name }
    })
  })
  if (APP_CONFIG.syncEnabled) void pushCategory(category)
  return category
}

export async function updateCategory(categoryId: string, patch: Partial<CategoryInput>): Promise<void> {
  let updated: Category | undefined
  await db.transaction('rw', db.categories, db.auditLogs, async () => {
    const existing = await db.categories.get(categoryId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบหมวดหมู่')
    const name = (patch.name ?? existing.name).trim()
    if (!name) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อหมวดหมู่')
    await assertNameUnique(existing.householdId, name, categoryId)
    updated = { ...existing, ...patch, name, updatedAt: nowIso() }
    await db.categories.put(updated)
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'category',
      entityId: categoryId,
      action: 'update_category',
      details: { patch }
    })
  })
  if (APP_CONFIG.syncEnabled && updated) void pushCategory(updated)
}

/** Categories referenced by existing expenses are never hard-deleted — only deactivated. */
export async function deactivateCategory(categoryId: string): Promise<void> {
  let updated: Category | undefined
  await db.transaction('rw', db.categories, db.auditLogs, async () => {
    const existing = await db.categories.get(categoryId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบหมวดหมู่')
    updated = { ...existing, status: 'inactive', updatedAt: nowIso() }
    await db.categories.put(updated)
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'category',
      entityId: categoryId,
      action: 'deactivate_category',
      details: {}
    })
  })
  if (APP_CONFIG.syncEnabled && updated) void pushCategory(updated)
}
