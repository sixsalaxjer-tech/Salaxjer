import { formatPlainNumber } from '@/shared/formatting/money'
import { formatWeekRangeThaiCompact } from '@/shared/formatting/date'

export interface WeeklySummaryLine {
  name: string
  total: number
}

export interface WeeklySummaryTextInput {
  total: number
  byCategory: WeeklySummaryLine[]
}

/**
 * Builds a plain-text expense summary formatted for pasting into a chat app (e.g. LINE), per the
 * user's requested format: one "Category: Amount" line per category, in the given order, followed
 * by a "Total: Amount" line. Pure and DB-free so it's independently testable; the caller resolves
 * category names before calling this.
 */
export function buildWeeklySummaryText(input: WeeklySummaryTextInput): string {
  const lines: string[] = []
  for (const c of input.byCategory) {
    lines.push(`${c.name}: ${formatPlainNumber(c.total)}`)
  }
  lines.push(`Total: ${formatPlainNumber(input.total)}`)
  return lines.join('\n')
}

export interface WeeklySummaryItem {
  categoryName: string
  amount: number
}

export interface WeeklySummaryDetailedTextInput {
  total: number
  byCategory: WeeklySummaryLine[]
  items: WeeklySummaryItem[]
  rangeStart: string
  rangeEnd: string
}

/**
 * A second text format offered alongside buildWeeklySummaryText, for the user to share to LINE:
 * a header naming the week's date range, one line per category listing that category's individual
 * item amounts joined by "+" (in item order), and a final "รวม" grand-total line. Pure and DB-free;
 * the caller resolves category names before calling this.
 */
export function buildWeeklySummaryDetailedText(input: WeeklySummaryDetailedTextInput): string {
  const lines: string[] = [
    `รายละเอียดรายการ วันที่ ${formatWeekRangeThaiCompact(input.rangeStart, input.rangeEnd)}`
  ]

  const amountsByCategory = new Map<string, number[]>()
  for (const item of input.items) {
    const amounts = amountsByCategory.get(item.categoryName)
    if (amounts) amounts.push(item.amount)
    else amountsByCategory.set(item.categoryName, [item.amount])
  }

  for (const c of input.byCategory) {
    const amounts = amountsByCategory.get(c.name) ?? []
    lines.push(`${c.name} ${amounts.map(formatPlainNumber).join('+')}`)
  }

  lines.push(`รวม ${formatPlainNumber(input.total)}`)
  return lines.join('\n')
}
