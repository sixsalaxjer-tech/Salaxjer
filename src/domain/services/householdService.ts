import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { isSupportedCurrency } from '@/shared/constants/currency'
import { nowIso } from '@/shared/formatting/date'
import { AppError, toAppError } from '@/shared/types/errors'
import { logger } from '@/infrastructure/logging/logger'
import { pushHousehold } from '@/infrastructure/sync/syncEngine'
import { APP_CONFIG } from '@/shared/constants/config'
import type { Household } from '@/domain/entities/types'
import { DEFAULT_CATEGORIES } from '@/domain/services/categoryService'

export interface CreateHouseholdInput {
  name: string
  baseCurrency: string
  monthStartDay: number
}

function validate(input: CreateHouseholdInput): void {
  if (!input.name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อครอบครัวและสกุลเงินหลัก')
  }
  if (!isSupportedCurrency(input.baseCurrency)) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อครอบครัวและสกุลเงินหลัก')
  }
  if (input.monthStartDay < 1 || input.monthStartDay > 28) {
    throw new AppError('VALIDATION_ERROR', 'วันเริ่มต้นรอบเดือนต้องอยู่ระหว่าง 1-28')
  }
}

/** FR-001: creates the Household plus a starter set of categories, in one transaction. */
export async function createHousehold(input: CreateHouseholdInput): Promise<Household> {
  validate(input)
  const now = nowIso()
  const household: Household = {
    householdId: uuidv4(),
    name: input.name.trim(),
    baseCurrency: input.baseCurrency,
    monthStartDay: input.monthStartDay,
    createdAt: now,
    updatedAt: now,
    version: 1
  }

  try {
    await db.transaction('rw', db.households, db.categories, db.auditLogs, async () => {
      await db.households.add(household)
      for (const c of DEFAULT_CATEGORIES) {
        await db.categories.add({
          categoryId: uuidv4(),
          householdId: household.householdId,
          name: c.name,
          icon: c.icon,
          color: c.color,
          isDefault: true,
          status: 'active',
          createdAt: now,
          updatedAt: now
        })
      }
      await recordAudit(db.auditLogs, {
        householdId: household.householdId,
        entityType: 'household',
        entityId: household.householdId,
        action: 'create_household',
        details: { name: household.name, baseCurrency: household.baseCurrency }
      })
    })
    logger.log('createHousehold', 'success', { entityType: 'household', entityId: household.householdId })
    return household
  } catch (err) {
    logger.log('createHousehold', 'error', { errorCode: 'STORAGE_WRITE_FAILED' })
    throw toAppError(err, 'บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ')
  }
}

export async function updateHousehold(
  householdId: string,
  patch: Partial<CreateHouseholdInput>
): Promise<void> {
  let next: Household | undefined
  await db.transaction('rw', db.households, db.auditLogs, async () => {
    const existing = await db.households.get(householdId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบข้อมูลครอบครัว')
    next = {
      ...existing,
      ...patch,
      name: (patch.name ?? existing.name).trim(),
      updatedAt: nowIso(),
      version: existing.version + 1
    }
    validate(next)
    await db.households.put(next)
    await recordAudit(db.auditLogs, {
      householdId,
      entityType: 'household',
      entityId: householdId,
      action: 'update_household',
      details: { patch }
    })
  })
  if (APP_CONFIG.syncEnabled && next) void pushHousehold(next)
}

/** MVP assumption: one Household per installed app instance (see spec section 6 assumptions). */
export async function getPrimaryHousehold(): Promise<Household | undefined> {
  return db.households.orderBy('name').first()
}
