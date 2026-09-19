import { formatMoney } from '@/shared/formatting/money'

export interface WeeklySummaryLine {
  icon?: string
  name: string
  total: number
}

export interface WeeklySummaryTextInput {
  rangeLabel: string
  currency: string
  total: number
  byCategory: WeeklySummaryLine[]
  byMember: WeeklySummaryLine[]
}

/**
 * Builds a plain-text weekly summary formatted for pasting into a chat app (e.g. LINE), per the
 * user's request. Pure and DB-free so it's independently testable; the caller resolves category
 * and member names/icons before calling this.
 */
export function buildWeeklySummaryText(input: WeeklySummaryTextInput): string {
  const lines: string[] = ['📊 สรุปค่าใช้จ่ายประจำสัปดาห์', input.rangeLabel, '']

  if (input.byCategory.length === 0) {
    lines.push('ยังไม่มีรายการในสัปดาห์นี้')
    return lines.join('\n')
  }

  const sortedCategories = [...input.byCategory].sort((a, b) => b.total - a.total)
  for (const c of sortedCategories) {
    lines.push(`${c.icon ? `${c.icon} ` : ''}${c.name}: ${formatMoney(c.total, input.currency)}`)
  }
  lines.push('──────────────')
  lines.push(`รวมทั้งหมด: ${formatMoney(input.total, input.currency)}`)

  if (input.byMember.length > 0) {
    lines.push('')
    lines.push('ยอดที่แต่ละคนจ่าย')
    const sortedMembers = [...input.byMember].sort((a, b) => b.total - a.total)
    for (const m of sortedMembers) {
      lines.push(`${m.name}: ${formatMoney(m.total, input.currency)}`)
    }
  }

  return lines.join('\n')
}
