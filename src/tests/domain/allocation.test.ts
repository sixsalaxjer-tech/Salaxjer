import { describe, expect, it } from 'vitest'
import {
  assertAllocationBalanced,
  computeEqualAllocation,
  computeExactAllocation,
  computePercentageAllocation
} from '@/domain/rules/allocation'
import { AppError } from '@/shared/types/errors'

describe('computeEqualAllocation', () => {
  it('splits evenly and reconciles rounding remainder (BR-003)', () => {
    const result = computeEqualAllocation(100, 'THB', ['a', 'b', 'c'])
    const sum = result.reduce((s, r) => s + r.allocatedAmount, 0)
    expect(sum).toBeCloseTo(100, 2)
    // 100 / 3 = 33.33... — exactly one share should absorb the extra minor unit.
    const amounts = result.map((r) => r.allocatedAmount).sort()
    expect(amounts).toEqual([33.33, 33.33, 33.34])
  })

  it('throws when no members are selected', () => {
    expect(() => computeEqualAllocation(100, 'THB', [])).toThrow(AppError)
  })

  it('respects zero-decimal currencies (JPY)', () => {
    const result = computeEqualAllocation(100, 'JPY', ['a', 'b', 'c'])
    const sum = result.reduce((s, r) => s + r.allocatedAmount, 0)
    expect(sum).toBe(100)
    expect(result.every((r) => Number.isInteger(r.allocatedAmount))).toBe(true)
  })
})

describe('computeExactAllocation', () => {
  it('accepts entries that sum exactly to the total', () => {
    const result = computeExactAllocation(100, 'THB', [
      { memberId: 'a', exactAmount: 60 },
      { memberId: 'b', exactAmount: 40 }
    ])
    expect(result.map((r) => r.allocatedAmount)).toEqual([60, 40])
  })

  it('rejects entries that do not sum to the total (VAL-005)', () => {
    expect(() =>
      computeExactAllocation(100, 'THB', [
        { memberId: 'a', exactAmount: 60 },
        { memberId: 'b', exactAmount: 30 }
      ])
    ).toThrow(AppError)
  })
})

describe('computePercentageAllocation', () => {
  it('accepts percentages summing to 100 and reconciles rounding', () => {
    const result = computePercentageAllocation(10, 'THB', [
      { memberId: 'a', percentage: 33.33 },
      { memberId: 'b', percentage: 33.33 },
      { memberId: 'c', percentage: 33.34 }
    ])
    const sum = result.reduce((s, r) => s + r.allocatedAmount, 0)
    expect(sum).toBeCloseTo(10, 2)
  })

  it('rejects percentages that do not sum to 100 (VAL-006)', () => {
    expect(() =>
      computePercentageAllocation(100, 'THB', [
        { memberId: 'a', percentage: 50 },
        { memberId: 'b', percentage: 40 }
      ])
    ).toThrow(AppError)
  })
})

describe('assertAllocationBalanced', () => {
  it('passes when allocations sum to the total', () => {
    expect(() =>
      assertAllocationBalanced(100, 'THB', [{ allocatedAmount: 50 }, { allocatedAmount: 50 }])
    ).not.toThrow()
  })

  it('throws when allocations do not sum to the total', () => {
    expect(() =>
      assertAllocationBalanced(100, 'THB', [{ allocatedAmount: 50 }, { allocatedAmount: 49 }])
    ).toThrow(AppError)
  })
})
