import { describe, expect, it } from 'vitest'
import { parseAmountList } from '@/domain/rules/batchAmount'

describe('parseAmountList', () => {
  it('splits a plus-separated list into individual amounts', () => {
    expect(parseAmountList('15+15+15+15')).toEqual([15, 15, 15, 15])
  })

  it('accepts a single amount', () => {
    expect(parseAmountList('600')).toEqual([600])
  })

  it('supports commas as an alternate separator and trims whitespace', () => {
    expect(parseAmountList(' 79, 30 , 40+16 ')).toEqual([79, 30, 40, 16])
  })

  it('drops non-numeric and non-positive pieces instead of throwing', () => {
    expect(parseAmountList('24+')).toEqual([24])
    expect(parseAmountList('abc+12+-5+0')).toEqual([12])
  })

  it('returns an empty array for blank input', () => {
    expect(parseAmountList('')).toEqual([])
    expect(parseAmountList('   ')).toEqual([])
  })
})
