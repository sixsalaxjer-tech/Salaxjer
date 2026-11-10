// Parser for card-spend notifications forwarded from LINE (e.g. UOB), Thai or English text.
//   "... มีการใช้บัตร UOB-2989 @LINEPAY*LP_BTS 17.00 THB วันที่ 09/11 วงเงินคงเหลือใช้ได้ 171,251.00 THB"
//   "You have spent THB 17.00 using UOB card (ending UOB-2989) at @LINEPAY*LP_BTS on 09/11. Available credit: THB 171,251.00"
// Each notification is usually pasted in both languages; Thai lines win and English is only a fallback.

export interface ParsedCardSpend {
  last4: string
  merchant: string
  amount: number
  /** ISO yyyy-MM-dd; the year is inferred (the notification only has dd/MM). */
  date: string
  availableCredit?: number
  /** Stable per notification: the running available-credit figure makes repeated identical purchases distinct. */
  fingerprint: string
}

const THAI =
  /มีการใช้บัตร\s+(?:[A-Za-z]+-)?(\d{4})\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s*THB\s+วันที่\s+(\d{1,2})\/(\d{1,2})(?:\s+วงเงินคงเหลือใช้ได้\s+([\d,]+(?:\.\d+)?))?/g

const ENGLISH =
  /spent\s+THB\s+([\d,]+(?:\.\d+)?)\s+using\s+.*?card\s+\(ending\s+(?:[A-Za-z]+-)?(\d{4})\)\s+at\s+(.+?)\s+on\s+(\d{1,2})\/(\d{1,2})\.?(?:\s+Available credit:\s+THB\s+([\d,]+(?:\.\d+)?))?/gi

const num = (s: string) => Number(s.replace(/,/g, ''))
const pad = (n: number) => String(n).padStart(2, '0')

/** dd/MM -> ISO date, choosing the most recent year that is not in the future relative to `todayIso`. */
export function inferDate(day: number, month: number, todayIso: string): string {
  const year = Number(todayIso.slice(0, 4))
  const candidate = `${year}-${pad(month)}-${pad(day)}`
  return candidate > todayIso ? `${year - 1}-${pad(month)}-${pad(day)}` : candidate
}

function build(
  last4: string,
  merchant: string,
  amount: string,
  day: string,
  month: string,
  avail: string | undefined,
  todayIso: string
): ParsedCardSpend | null {
  const d = Number(day)
  const m = Number(month)
  const amt = num(amount)
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12) || !Number.isFinite(amt) || amt <= 0) return null
  const date = inferDate(d, m, todayIso)
  const availableCredit = avail ? num(avail) : undefined
  return {
    last4,
    merchant: merchant.trim().replace(/^@/, ''),
    amount: amt,
    date,
    availableCredit,
    fingerprint: `${last4}|${date}|${amt.toFixed(2)}|${availableCredit?.toFixed(2) ?? ''}`
  }
}

export function parseCardNotifications(text: string, todayIso: string): ParsedCardSpend[] {
  const thai: ParsedCardSpend[] = []
  for (const m of text.matchAll(THAI)) {
    const r = build(m[1], m[2], m[3], m[4], m[5], m[6], todayIso)
    if (r) thai.push(r)
  }
  const found = thai
  if (found.length === 0) {
    for (const m of text.matchAll(ENGLISH)) {
      const r = build(m[2], m[3], m[1], m[4], m[5], m[6], todayIso)
      if (r) found.push(r)
    }
  }
  // Drop exact duplicates (same notification pasted twice); keep order.
  const seen = new Set<string>()
  return found.filter((r) => (seen.has(r.fingerprint) ? false : (seen.add(r.fingerprint), true)))
}
