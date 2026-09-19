import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { supabase } from '@/infrastructure/sync/supabaseClient'
import { dbToHousehold } from '@/infrastructure/sync/mappers'
import { pullAll, pushCategory, startRealtimeSync } from '@/infrastructure/sync/syncEngine'
import { DEFAULT_CATEGORIES } from '@/domain/services/categoryService'
import { isSupportedCurrency } from '@/shared/constants/currency'
import { nowIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import type { Category, Household } from '@/domain/entities/types'

/**
 * Supabase-backed equivalent of householdService's create flow, called once by whoever logs in
 * first with no household yet (see HouseholdSetupScreen). The household id is authored by the
 * database, not the client, since `create_household_with_owner` also mints the invite code and
 * the owner's household_members row atomically — see supabase/schema.sql.
 */
export async function createCloudHousehold(input: {
  name: string
  baseCurrency: string
  monthStartDay: number
}): Promise<Household> {
  if (!supabase) throw new AppError('UNKNOWN', 'ยังไม่ได้ตั้งค่าระบบออนไลน์')
  if (!input.name.trim()) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อครอบครัวและสกุลเงินหลัก')
  if (!isSupportedCurrency(input.baseCurrency)) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อครอบครัวและสกุลเงินหลัก')
  }

  const { data, error } = await supabase.rpc('create_household_with_owner', {
    p_name: input.name.trim(),
    p_base_currency: input.baseCurrency,
    p_month_start_day: input.monthStartDay
  })
  if (error || !data) throw new AppError('UNKNOWN', 'สร้างครอบครัวไม่สำเร็จ กรุณาลองใหม่', error)

  const household = dbToHousehold(data)
  await db.households.put(household)

  const now = nowIso()
  for (const c of DEFAULT_CATEGORIES) {
    const category: Category = {
      categoryId: uuidv4(),
      householdId: household.householdId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      isDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    await db.categories.add(category)
    await pushCategory(category)
  }

  startRealtimeSync(household.householdId)
  return household
}

/**
 * Links a second (admin-created — see docs/CLOUD_SYNC.md) account to an existing household by
 * invite code, then pulls all of that household's existing data down before the rest of the app
 * renders.
 */
export async function joinCloudHousehold(inviteCode: string): Promise<Household> {
  if (!supabase) throw new AppError('UNKNOWN', 'ยังไม่ได้ตั้งค่าระบบออนไลน์')
  if (!inviteCode.trim()) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุรหัสเชิญ')

  const { data, error } = await supabase.rpc('join_household_by_invite_code', {
    p_invite_code: inviteCode.trim()
  })
  if (error || !data) throw new AppError('VALIDATION_ERROR', 'รหัสเชิญไม่ถูกต้องหรือหมดอายุ', error)

  const household = dbToHousehold(data)
  await db.households.put(household)
  await pullAll(household.householdId)
  startRealtimeSync(household.householdId)
  return household
}
