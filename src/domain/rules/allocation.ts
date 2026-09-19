import { AppError } from '@/shared/types/errors'
import { fromMinorUnits, toMinorUnits } from '@/shared/formatting/money'
import type { AllocationType } from '@/domain/entities/types'

export interface AllocationInput {
  memberId: string
  /** Required for 'exact' */
  exactAmount?: number
  /** Required for 'percentage', 0-100 */
  percentage?: number
}

export interface ComputedAllocation {
  memberId: string
  allocationType: AllocationType
  percentage?: number
  allocatedAmount: number
}

const PERCENTAGE_TOLERANCE = 0.01

/**
 * Distributes `totalMinor` across `count` shares as evenly as possible in integer minor units.
 * Any remainder from integer division is assigned one unit at a time to the first shares,
 * which keeps the split deterministic and guarantees the sum always equals totalMinor (BR-003).
 */
function distributeEvenly(totalMinor: number, count: number): number[] {
  const base = Math.floor(totalMinor / count)
  const remainder = totalMinor - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * Reconciles rounded shares against a target total by nudging the largest share(s) so the sum
 * matches exactly. Used for percentage splits where each member's rounded amount may not sum to
 * the total because of independent rounding (BR-003, BR-011).
 */
function reconcileToTotal(shares: number[], targetMinor: number): number[] {
  const result = [...shares]
  let diff = targetMinor - result.reduce((a, b) => a + b, 0)
  if (diff === 0) return result
  const step = diff > 0 ? 1 : -1
  // Apply the correction to the largest share(s) first, one minor unit at a time.
  const order = result
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i)
  let cursor = 0
  while (diff !== 0 && order.length > 0) {
    const idx = order[cursor % order.length]
    result[idx] += step
    diff -= step
    cursor++
  }
  return result
}

export function computeEqualAllocation(
  totalAmount: number,
  currency: string,
  memberIds: string[]
): ComputedAllocation[] {
  if (memberIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาเลือกผู้รับผิดชอบอย่างน้อยหนึ่งคน')
  }
  const totalMinor = toMinorUnits(totalAmount, currency)
  const shares = distributeEvenly(totalMinor, memberIds.length)
  return memberIds.map((memberId, i) => ({
    memberId,
    allocationType: 'equal',
    allocatedAmount: fromMinorUnits(shares[i], currency)
  }))
}

export function computeExactAllocation(
  totalAmount: number,
  currency: string,
  entries: AllocationInput[]
): ComputedAllocation[] {
  if (entries.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุยอดของผู้รับผิดชอบอย่างน้อยหนึ่งคน')
  }
  const totalMinor = toMinorUnits(totalAmount, currency)
  const entryMinors = entries.map((e) => toMinorUnits(e.exactAmount ?? 0, currency))
  const sumMinor = entryMinors.reduce((a, b) => a + b, 0)
  if (sumMinor !== totalMinor) {
    const diff = fromMinorUnits(totalMinor - sumMinor, currency)
    throw new AppError(
      'ALLOCATION_IMBALANCE',
      `ยอดแบ่งค่าใช้จ่ายไม่เท่ากับยอดรวม (ส่วนต่าง ${diff.toFixed(2)})`
    )
  }
  return entries.map((e, i) => ({
    memberId: e.memberId,
    allocationType: 'exact',
    allocatedAmount: fromMinorUnits(entryMinors[i], currency)
  }))
}

export function computePercentageAllocation(
  totalAmount: number,
  currency: string,
  entries: AllocationInput[]
): ComputedAllocation[] {
  if (entries.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุเปอร์เซ็นต์ของผู้รับผิดชอบอย่างน้อยหนึ่งคน')
  }
  const totalPercentage = entries.reduce((sum, e) => sum + (e.percentage ?? 0), 0)
  if (Math.abs(totalPercentage - 100) > PERCENTAGE_TOLERANCE) {
    throw new AppError(
      'ALLOCATION_IMBALANCE',
      `เปอร์เซ็นต์รวมต้องเท่ากับ 100 (ปัจจุบันรวม ${totalPercentage.toFixed(2)}%)`
    )
  }
  const totalMinor = toMinorUnits(totalAmount, currency)
  const rawShares = entries.map((e) => Math.round((totalMinor * (e.percentage ?? 0)) / 100))
  const reconciled = reconcileToTotal(rawShares, totalMinor)
  return entries.map((e, i) => ({
    memberId: e.memberId,
    allocationType: 'percentage',
    percentage: e.percentage,
    allocatedAmount: fromMinorUnits(reconciled[i], currency)
  }))
}

/** Safety net re-validation before persisting (BR-003), independent of which compute*Allocation was used. */
export function assertAllocationBalanced(
  totalAmount: number,
  currency: string,
  allocations: { allocatedAmount: number }[]
): void {
  const totalMinor = toMinorUnits(totalAmount, currency)
  const sumMinor = allocations.reduce((sum, a) => sum + toMinorUnits(a.allocatedAmount, currency), 0)
  if (sumMinor !== totalMinor) {
    const diff = fromMinorUnits(totalMinor - sumMinor, currency)
    throw new AppError(
      'ALLOCATION_IMBALANCE',
      `ยอดแบ่งค่าใช้จ่ายไม่เท่ากับยอดรวม (ส่วนต่าง ${diff.toFixed(2)})`
    )
  }
}
