import { describe, expect, it } from 'vitest'
import { parseCardText } from '@/domain/rules/cardStatement'
import { resolveWithRules } from '@/domain/rules/merchantRules'

const PASTE = `2026.10.26 Monday
18:54 UOB Thai มีการใช้บัตร UOB-2989 @LINEPAY*LP_BTS 17.00 THB วันที่ 26/10 วงเงินคงเหลือใช้ได้ 172,496.00 THB

You have spent THB 17.00 using UOB card (ending UOB-2989) at @LINEPAY*LP_BTS on 26/10. Available credit: THB 172,496.00

09:40 UOB Thai มีการใช้บัตร UOB-2989 @BSS*BTS 900.00 THB วันที่ 15/10 วงเงินคงเหลือใช้ได้ 170,545.00 THB

You have spent THB 900.00 using UOB card (ending UOB-2989) at @BSS*BTS on 15/10. Available credit: THB 170,545.00
12:47 UOB Thai มีการใช้บัตร UOB-6350 @TMN FAST FOOD 55.00 THB วันที่ 15/10 วงเงินคงเหลือใช้ได้ 173,143.00 THB

You have spent THB 55.00 using UOB card (ending UOB-6350) at @TMN FAST FOOD on 15/10. Available credit: THB 173,143.00
02:35 UOB Thai มีการใช้บัตร UOB-2989 @MRT-BEM 39.00 THB วันที่ 04/11 วงเงินคงเหลือใช้ได้ 168,369.00 THB

You have spent THB 39.00 using UOB card (ending UOB-2989) at @MRT-BEM on 04/11. Available credit: THB 168,369.00`

describe('LINE notifications with time/sender prefixes', () => {
  const rows = parseCardText(PASTE, '2026-11-10')

  it('parses each notification once, ignoring date headers and English duplicates', () => {
    expect(rows.map((r) => [r.last4, r.merchant, r.amount, r.date])).toEqual([
      ['2989', 'LINEPAY*LP_BTS', 17, '2026-10-26'],
      ['2989', 'BSS*BTS', 900, '2026-10-15'],
      ['6350', 'TMN FAST FOOD', 55, '2026-10-15'],
      ['2989', 'MRT-BEM', 39, '2026-11-04']
    ])
  })

  it('classifies the shipped defaults for these merchants', () => {
    const cats = [
      { categoryId: 'food', name: 'อาหาร' },
      { categoryId: 'trip', name: 'เดินทาง' }
    ]
    expect(rows.map((r) => resolveWithRules(r.merchant, [], cats).categoryId)).toEqual(['trip', 'trip', 'food', 'trip'])
  })
})
