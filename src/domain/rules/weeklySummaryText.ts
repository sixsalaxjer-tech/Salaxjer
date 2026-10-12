import { formatPlainNumber } from '@/shared/formatting/money'
import { formatWeekRangeThaiCompact } from '@/shared/formatting/date'

export interface WeeklySummaryLine {
  name: string
  total: number
}

export interface WeeklySummaryItem {
  categoryName: string
  description: string
  amount: number
}

export interface WeeklySummaryTextInput {
  total: number
  byCategory: WeeklySummaryLine[]
  items: WeeklySummaryItem[]
  rangeStart: string
  rangeEnd: string
}

/** The only categories shown as a single "name total" line; every other category is itemized. */
const SUMMED_CATEGORY_NAMES = new Set(['อาหาร', 'เดินทาง'])

function buildHeader(rangeStart: string, rangeEnd: string): string {
  return `รายละเอียดรายการ วันที่ ${formatWeekRangeThaiCompact(rangeStart, rangeEnd)}`
}

/**
 * The short text format, for the user to share to LINE:
 * a header naming the week's date range, then one line per category, and a final "รวม" grand-total
 * line. "อาหาร" and "เดินทาง" are dense, everyday categories, so they collapse to one
 * "name total" line; every other category's items are one-off enough to want the detail, so each
 * item gets its own "name description amount" line instead of being summed together. Pure and
 * DB-free; the caller resolves category names before calling this.
 */
export function buildWeeklySummaryText(input: WeeklySummaryTextInput): string {
  const lines: string[] = [buildHeader(input.rangeStart, input.rangeEnd)]

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

/**
 * The detailed text format: one "name description amount" line per distinct item, grouped by
 * category (in byCategory order). Repeats of the same description within a category are joined
 * onto one line as "amount+amount". No per-category collapsing and no grand total. Pure and DB-free.
 */
export function buildWeeklySummaryDetailedText(
  input: Pick<WeeklySummaryTextInput, 'byCategory' | 'items'>
): string {
  const lines: string[] = []
  for (const c of input.byCategory) {
    const amountsByDescription = new Map<string, number[]>()
    for (const item of input.items) {
      if (item.categoryName !== c.name) continue
      const amounts = amountsByDescription.get(item.description)
      if (amounts) amounts.push(item.amount)
      else amountsByDescription.set(item.description, [item.amount])
    }
    for (const [description, amounts] of amountsByDescription) {
      lines.push(`${c.name} ${description} ${amounts.map(formatPlainNumber).join('+')}`)
    }
  }
  return lines.join('\n')
}
