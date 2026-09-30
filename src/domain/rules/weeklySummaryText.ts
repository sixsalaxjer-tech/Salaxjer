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

/** Category whose items are listed individually rather than summed onto one line (see below). */
const OTHER_CATEGORY_NAME = 'อื่นๆ'

/**
 * A second text format offered alongside buildWeeklySummaryText, for the user to share to LINE:
 * a header naming the week's date range, one line per category listing that category's individual
 * item amounts joined by "+" (in item order), and a final "รวม" grand-total line. The "อื่นๆ" (Other)
 * category is the exception: since its items are usually unrelated one-offs, each is listed on its
 * own line as "description amount" instead of being summed together. Pure and DB-free; the caller
 * resolves category names before calling this.
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
    const items = itemsByCategory.get(c.name) ?? []
    if (c.name === OTHER_CATEGORY_NAME) {
      for (const item of items) {
        lines.push(`${item.description} ${formatPlainNumber(item.amount)}`)
      }
    } else {
      lines.push(`${c.name} ${items.map((item) => formatPlainNumber(item.amount)).join('+')}`)
    }
  }

  lines.push(`รวม ${formatPlainNumber(input.total)}`)
  return lines.join('\n')
}
