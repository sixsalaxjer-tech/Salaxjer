import { describe, expect, it } from 'vitest'
import { buildWeeklySummaryText } from '@/domain/rules/weeklySummaryText'

describe('buildWeeklySummaryText', () => {
  it('formats categories sorted by amount descending, then a total, then members', () => {
    const text = buildWeeklySummaryText({
      rangeLabel: '16 - 22 ก.ย. 2569',
      currency: 'THB',
      total: 1150,
      byCategory: [
        { icon: '🚗', name: 'เดินทาง', total: 300 },
        { icon: '🍜', name: 'อาหาร', total: 850 }
      ],
      byMember: [
        { name: 'แม่', total: 300 },
        { name: 'พ่อ', total: 850 }
      ]
    })

    const lines = text.split('\n')
    expect(lines[0]).toBe('📊 สรุปค่าใช้จ่ายประจำสัปดาห์')
    expect(lines[1]).toBe('16 - 22 ก.ย. 2569')
    // อาหาร (850) must be listed before เดินทาง (300) — sorted descending.
    expect(text.indexOf('อาหาร')).toBeLessThan(text.indexOf('เดินทาง'))
    expect(text).toContain('รวมทั้งหมด: ฿1,150.00')
    expect(text.indexOf('พ่อ')).toBeLessThan(text.indexOf('แม่'))
  })

  it('shows an empty-week message when there is no data', () => {
    const text = buildWeeklySummaryText({
      rangeLabel: '1 - 7 ม.ค. 2569',
      currency: 'THB',
      total: 0,
      byCategory: [],
      byMember: []
    })
    expect(text).toContain('ยังไม่มีรายการในสัปดาห์นี้')
  })

  it('omits the per-member section when there is only one payer or none', () => {
    const text = buildWeeklySummaryText({
      rangeLabel: '1 - 7 ม.ค. 2569',
      currency: 'THB',
      total: 100,
      byCategory: [{ name: 'อื่นๆ', total: 100 }],
      byMember: []
    })
    expect(text).not.toContain('ยอดที่แต่ละคนจ่าย')
  })
})
