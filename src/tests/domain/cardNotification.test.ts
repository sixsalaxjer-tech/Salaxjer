import { describe, expect, it } from 'vitest'
import { inferDate, parseCardNotifications } from '@/domain/rules/cardNotification'

const SAMPLE = `11:48 Six-Salaxjer มีการใช้บัตร UOB-2989 @LINEPAY*LP_BTS 17.00 THB วันที่ 09/11 วงเงินคงเหลือใช้ได้ 171,251.00 THB

You have spent THB 17.00 using UOB card (ending UOB-2989) at @LINEPAY*LP_BTS on 09/11. Available credit: THB 171,251.00
11:48 Six-Salaxjer มีการใช้บัตร UOB-6350 @TMN 7-11 121.00 THB วันที่ 09/11 วงเงินคงเหลือใช้ได้ 171,130.00 THB

You have spent THB 121.00 using UOB card (ending UOB-6350) at @TMN 7-11 on 09/11. Available credit: THB 171,130.00
11:48 Six-Salaxjer มีการใช้บัตร UOB-2989 @LINEPAY*LP_BTS 17.00 THB วันที่ 10/11 วงเงินคงเหลือใช้ได้ 171,096.00 THB
11:48 Six-Salaxjer มีการใช้บัตร UOB-2989 @LINEPAY*LP_BTS 17.00 THB วันที่ 10/11 วงเงินคงเหลือใช้ได้ 171,064.00 THB`

describe('parseCardNotifications', () => {
  it('parses Thai lines, ignoring the English duplicates', () => {
    const r = parseCardNotifications(SAMPLE, '2026-11-10')
    expect(r).toHaveLength(4)
    expect(r[0]).toMatchObject({ last4: '2989', merchant: 'LINEPAY*LP_BTS', amount: 17, date: '2026-11-09', availableCredit: 171251 })
    expect(r[1]).toMatchObject({ last4: '6350', merchant: 'TMN 7-11', amount: 121 })
  })

  it('keeps identical purchases distinct via available credit', () => {
    const r = parseCardNotifications(SAMPLE, '2026-11-10')
    expect(new Set(r.map((x) => x.fingerprint)).size).toBe(4)
  })

  it('falls back to English text', () => {
    const r = parseCardNotifications(
      'You have spent THB 15.00 using UOB card (ending UOB-2989) at @LINEPAY*LP_BRT EV BUS on 10/11. Available credit: THB 171,081.00',
      '2026-11-10'
    )
    expect(r).toEqual([expect.objectContaining({ last4: '2989', merchant: 'LINEPAY*LP_BRT EV BUS', amount: 15, date: '2026-11-10' })])
  })

  it('drops pasted-twice duplicates and returns [] for junk', () => {
    const one = SAMPLE.split('\n')[0]
    expect(parseCardNotifications(`${one}\n${one}`, '2026-11-10')).toHaveLength(1)
    expect(parseCardNotifications('hello', '2026-11-10')).toEqual([])
  })
})

describe('inferDate', () => {
  it('uses the previous year for dates in the future', () => {
    expect(inferDate(28, 12, '2027-01-02')).toBe('2026-12-28')
  })
})
