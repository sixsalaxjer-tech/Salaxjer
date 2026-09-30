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
  description: string
  amount: number
}

export interface WeeklySummaryDetailedTextInput {
  total: number
  byCategory: WeeklySummaryLine[]
  items: WeeklySummaryItem[]
  rangeStart: string
  rangeEnd: string
}

/** The only categories shown as a single "name total" line; every other category is itemized. */
const SUMMED_CATEGORY_NAMES = new Set(['อาหาร', 'เดินทาง'])

/**
 * A second text format offered alongside buildWeeklySummaryText, for the user to share to LINE:
 * a header naming the week's date range, then one line per category, and a final "รวม" grand-total
 * line. "อาหาร" and "เดินทาง" are dense, everyday categories, so they collapse to one
 * "name total" line; every other category's items are one-off enough to want the detail, so each
 * item gets its own "name description amount" line instead of being summed together. Pure and
 * DB-free; the caller resolves category names before calling this.
 */
export function buildWeeklySummaryDetailedText(input: WeeklySummaryDetailedTextInput): string {
  const lines: string[] = [
    `รายละเอียดรายการ วันที่ ${formatWeekRangeThaiCompact(input.rangeStart, input.rangeEnd)}`
  ]

  const itemsByCategory = new Map<string, WeeklySummaryItem[]>()
  for (const item of input.items) {
    const items = itemsByCategory.get(item.categoryName)
    if (items) items.push(item)
    else itemsByCategory.set(item.categoryName, [item])
  }

  for (const c of input.byCategory) {
    if (SUMMED_CATEGORY_NAMES.has(c.name)) {
      lines.push(`${c.name} ${formatPlainNumber(c.total)}`)
      continue
    }
    const items = itemsByCategory.get(c.name) ?? []
    for (const item of items) {
      lines.push(`${c.name} ${item.description} ${formatPlainNumber(item.amount)}`)
    }
  }

  lines.push(`รวม ${formatPlainNumber(input.total)}`)
  return lines.join('\n')
}
