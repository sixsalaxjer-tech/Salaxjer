import { describe, expect, it } from 'vitest'
import { looksLikeStatement, parseCardStatement, parseCardText } from '@/domain/rules/cardStatement'
import { fragmentsToLines } from '@/domain/rules/pdfText'

const STATEMENT = `วนั สรุปยอดบญั ชี / STATEMENT DATE 18 OCT 2026
สรุปรายการ / ACCOUNT SUMMARY1
5257 20XX XXXX 1025 5,350.00 428.00
4033 75XX XXXX 2989 2,523.13 202.00
5257 20XX XXXX 1025 SUPHEE AKARAPENPAN
PREVIOUS BALANCE 0.00
22 SEP 22 SEP PAYMENT THANK YOU - UOBT TMRW APP 680.00 CR
23 SEP 22 SEP FACULTY OF DENTISTRY C BANGKOK 680.00
15 OCT 30 SEP CARD MEMBERSHIP FEE - WITH VAT 7% 5,350.00
SUB TOTAL 5,350.00
TOTAL BALANCE - UOB PREMIER 5,350.00
5432 15XX XXXX 6350 SUPHEE AKARAPENPAN
15 OCT 10 OCT SHOPEE *SHOPEE BANGKOK 123.00 CR
21 SEP 19 SEP SHOPEE *SHOPEE BANGKOK 24.00
4033 75XX XXXX 2989 SUPHEE AKARAPENPAN
PREVIOUS BALANCE 3,896.03
30 SEP 30 SEP UOB One Cashback 10% 5% 417.65 CR
16 SEP 13 SEP TMN*TMN 7-11 BANGKOK 20.00
16 SEP 15 SEP LINEPAY*LP_BTS BANGKOK 17.00
16 SEP 15 SEP LINEPAY*LP_BTS BANGKOK 17.00
16 SEP 15 SEP LINEPAY*LP_BTS BANGKOK 17.00
21 SEP 18 SEP LINEPAY *LP_AIS SERVICE BANGKOK 1,359.97
SUB TOTAL 2,523.13`

describe('parseCardStatement', () => {
  const rows = parseCardStatement(STATEMENT)

  it('assigns rows to the card section they appear under, skipping summary tables', () => {
    expect(rows.map((r) => r.last4)).toEqual(['1025', '1025', '6350', '2989', '2989', '2989', '2989', '2989'])
  })

  it('skips payments, refunds, cashback, balances and totals (credits and non-purchases)', () => {
    expect(rows.some((r) => /PAYMENT|CASHBACK|PREVIOUS|TOTAL/i.test(r.merchant))).toBe(false)
    expect(rows.find((r) => r.merchant.startsWith('SHOPEE') && r.amount === 123)).toBeUndefined()
  })

  it('reads amounts with thousands separators and strips the trailing city', () => {
    const ais = rows.find((r) => r.merchant.includes('LP_AIS'))
    expect(ais).toMatchObject({ amount: 1359.97, merchant: 'LINEPAY *LP_AIS SERVICE', date: '2026-09-18' })
  })

  it('uses the transaction date and infers the year from the statement date', () => {
    expect(rows[0]).toMatchObject({ date: '2026-09-22', amount: 680 })
    expect(parseCardStatement(STATEMENT.replace('18 OCT 2026', '05 JAN 2027'))[0].date).toBe('2026-09-22')
    expect(parseCardStatement(STATEMENT.replace('18 OCT 2026', '05 JAN 2027').replace('13 SEP', '13 DEC')).find((r) => r.amount === 20)!.date).toBe('2026-12-13')
  })

  it('keeps identical same-day rows distinct', () => {
    const bts = rows.filter((r) => r.merchant === 'LINEPAY*LP_BTS')
    expect(bts).toHaveLength(3)
    expect(new Set(bts.map((r) => r.fingerprint)).size).toBe(3)
  })
})

describe('parseCardText', () => {
  it('detects statements vs LINE notifications', () => {
    expect(looksLikeStatement(STATEMENT)).toBe(true)
    expect(looksLikeStatement('hello')).toBe(false)
    const line = 'มีการใช้บัตร UOB-2989 @TMN*TMN 7-11 20.00 THB วันที่ 10/11 วงเงินคงเหลือใช้ได้ 171,044.00 THB'
    expect(parseCardText(line, '2026-11-10')).toHaveLength(1)
    expect(parseCardText(STATEMENT, '2026-11-10').length).toBe(8)
  })
})

describe('fragmentsToLines', () => {
  it('rebuilds lines top-to-bottom, left-to-right', () => {
    const lines = fragmentsToLines([
      { text: '17.00', x: 300, y: 700 },
      { text: '16 SEP', x: 50, y: 700.5 },
      { text: 'LINEPAY*LP_BTS', x: 120, y: 700 },
      { text: 'second', x: 50, y: 680 }
    ])
    expect(lines).toEqual(['16 SEP LINEPAY*LP_BTS 17.00', 'second'])
  })
})
