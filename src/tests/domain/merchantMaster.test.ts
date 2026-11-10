import { describe, expect, it } from 'vitest'
import { resolveWithRules } from '@/domain/rules/merchantRules'

const cats = [
  { categoryId: 'food', name: 'อาหาร' },
  { categoryId: 'trip', name: 'เดินทาง' },
  { categoryId: 'shop', name: 'ช้อปปิ้ง' }
]

describe('resolveWithRules', () => {
  it('prefers household rules, and the longest matching keyword', () => {
    const rules = [
      { keyword: 'shopee', categoryId: 'shop' },
      { keyword: 'SHOPEEPAY', description: 'ShopeePay', categoryId: 'food' }
    ]
    expect(resolveWithRules('SHOPEE *SHOPEE', rules, cats)).toEqual({
      description: 'SHOPEE *SHOPEE',
      categoryId: 'shop',
      source: 'rule'
    })
    expect(resolveWithRules('SHOPEEPAY*SHOPEE', rules, cats)).toEqual({
      description: 'ShopeePay',
      categoryId: 'food',
      source: 'rule'
    })
  })

  it('lets a household rule override a shipped default', () => {
    expect(resolveWithRules('TMN*TMN 7-11', [{ keyword: '7-11', categoryId: 'shop' }], cats).categoryId).toBe('shop')
  })

  it('falls back to shipped defaults by category name, then to none', () => {
    expect(resolveWithRules('LINEPAY*LP_BTS', [], cats)).toEqual({
      description: 'ค่าเดินทาง BTS',
      categoryId: 'trip',
      source: 'builtin'
    })
    expect(resolveWithRules('Other Shop', [], cats)).toEqual({ description: 'Other Shop', source: 'none' })
    // the default matches but the household has no such category -> no category suggested
    expect(resolveWithRules('LINEPAY*LP_BTS', [], [{ categoryId: 'x', name: 'อื่นๆ' }]).categoryId).toBeUndefined()
  })

  it('ignores blank keywords', () => {
    expect(resolveWithRules('Anything', [{ keyword: '  ', categoryId: 'shop' }], cats).source).toBe('none')
  })
})
