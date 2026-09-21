import { formatPlainNumber } from '@/shared/formatting/money'
import { formatDayMonthThai } from '@/shared/formatting/date'

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
  date: string
  description: string
  categoryName: string
  memberName: string
  amount: number
}

export interface WeeklySummaryDetailedTextInput extends WeeklySummaryTextInput {
  items: WeeklySummaryItem[]
}

/**
 * A second, more detailed text format offered alongside buildWeeklySummaryText, so the user can
 * choose which one to share to LINE. Adds a per-item line (date, description, category, payer,
 * amount) below the same category/total lines. Pure and DB-free; the caller resolves category and
 * member names before calling this.
 */
export function buildWeeklySummaryDetailedText(input: WeeklySummaryDetailedTextInput): string {
  const lines: string[] = [buildWeeklySummaryText(input)]

  if (input.items.length > 0) {
    lines.push('')
    lines.push('รายละเอียดรายการ')
    for (const item of input.items) {
      const desc = item.description || 'ไม่มีรายละเอียด'
      lines.push(
        `${formatDayMonthThai(item.date)} ${desc} (${item.categoryName} • ${item.memberName}): ${formatPlainNumber(item.amount)}`
      )
    }
  }

  return lines.join('\n')
}
