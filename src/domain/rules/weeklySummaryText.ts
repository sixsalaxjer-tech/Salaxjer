import { formatPlainNumber } from '@/shared/formatting/money'

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
