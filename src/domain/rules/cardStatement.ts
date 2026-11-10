import { parseCardNotifications, type ParsedCardSpend } from '@/domain/rules/cardNotification'

// Parser for UOB monthly credit-card statements (text extracted from the PDF, one line per row):
//   "STATEMENT DATE 18 OCT 2026"
//   "4033 75XX XXXX 2989 SUPHEE AKARAPENPAN"          <- starts a card section
//   "16 SEP 15 SEP LINEPAY*LP_BTS BANGKOK 17.00"      <- post date, trans date, description, amount
// Only debits are returned; credits ("... CR": payments, refunds, cashback) are skipped.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const STATEMENT_DATE = /STATEMENT DATE\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/
const CARD_HEADER = /^\d{4}\s+\d{2}XX\s+XXXX\s+(\d{4})\s+[A-Za-z][A-Za-z .]+$/
const TX_LINE = /^(\d{2})\s+([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(.+?)\s+([\d,]+\.\d{2})(\s+CR)?$/
const NON_PURCHASE = /PAYMENT THANK YOU|PREVIOUS BALANCE|SUB TOTAL|^TOTAL /i

export function looksLikeStatement(text: string): boolean {
  return STATEMENT_DATE.test(text) && /\d{4}\s+\d{2}XX\s+XXXX\s+\d{4}/.test(text)
}

export function parseCardStatement(text: string): ParsedCardSpend[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const stmt = lines.map((l) => STATEMENT_DATE.exec(l)).find(Boolean)
  if (!stmt) return []
  const stmtMonth = MONTHS.indexOf(stmt[2])
  const stmtYear = Number(stmt[3])
  if (stmtMonth < 0) return []

  const results: ParsedCardSpend[] = []
  const seen = new Map<string, number>()
  let last4: string | undefined

  for (const line of lines) {
    const header = CARD_HEADER.exec(line)
    if (header) {
      last4 = header[1]
      continue
    }
    if (!last4) continue
    const m = TX_LINE.exec(line)
    if (!m || m[7] || NON_PURCHASE.test(m[5])) continue

    const month = MONTHS.indexOf(m[4])
    if (month < 0) continue
    const year = month > stmtMonth ? stmtYear - 1 : stmtYear
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${m[3]}`
    const amount = Number(m[6].replace(/,/g, ''))
    const merchant = m[5].replace(/\s+Bangkok$/i, '').trim()

    // Identical rows on the same day (e.g. three 17.00 BTS taps) stay distinct via an occurrence index.
    const base = `stmt|${last4}|${date}|${amount.toFixed(2)}|${merchant}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    results.push({ last4, merchant, amount, date, fingerprint: `${base}|${n}` })
  }
  return results
}

/** Accepts either a pasted statement or LINE spend notifications, detecting which one it is. */
export function parseCardText(text: string, todayIso: string): ParsedCardSpend[] {
  return looksLikeStatement(text) ? parseCardStatement(text) : parseCardNotifications(text, todayIso)
}
