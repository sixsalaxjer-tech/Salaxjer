import { describe, expect, it } from 'vitest'
import { buildWeeklySummaryText, buildWeeklySummaryDetailedText } from '@/domain/rules/weeklySummaryText'

describe('buildWeeklySummaryText', () => {
  it('formats one "Category: Amount" line per category, in the given order, then a Total line', () => {
    const text = buildWeeklySummaryText({
      total: 7673,
      byCategory: [
        { name: 'Food', total: 2485 },
        { name: 'Motorcycle taxi', total: 15 },
        { name: 'Portine', total: 2300 },
        { name: 'Home', total: 73 },
        { name: 'Car maintenance', total: 2800 }
      ]
    })

    expect(text).toBe(
      [
        'Food: 2,485',
        'Motorcycle taxi: 15',
        'Portine: 2,300',
        'Home: 73',
        'Car maintenance: 2,800',
        'Total: 7,673'
      ].join('\n')
    )
  })

  it('shows just the total when there is no category data', () => {
    const text = buildWeeklySummaryText({ total: 0, byCategory: [] })
    expect(text).toBe('Total: 0')
  })

  it('rounds fractional amounts to whole numbers', () => {
    const text = buildWeeklySummaryText({
      total: 100.5,
      byCategory: [{ name: 'อื่นๆ', total: 100.5 }]
    })
    expect(text).toBe('อื่นๆ: 101\nTotal: 101')
  })
})

describe('buildWeeklySummaryDetailedText', () => {
  it('adds a per-item detail section below the same category/total lines, in item order', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 1150,
      byCategory: [
        { name: 'อาหาร', total: 850 },
        { name: 'เดินทาง', total: 300 }
      ],
      items: [
        { date: '2026-09-16', description: 'ก๋วยเตี๋ยว', amount: 850, categoryName: 'อาหาร', memberName: 'พ่อ' },
        { date: '2026-09-18', description: 'ค่าน้ำมัน', amount: 300, categoryName: 'เดินทาง', memberName: 'แม่' }
      ]
    })

    expect(text.startsWith(buildWeeklySummaryText({ total: 1150, byCategory: [{ name: 'อาหาร', total: 850 }, { name: 'เดินทาง', total: 300 }] }))).toBe(true)
    expect(text).toContain('รายละเอียดรายการ')
    expect(text).toContain('ก๋วยเตี๋ยว (อาหาร • พ่อ): 850')
    expect(text.indexOf('ก๋วยเตี๋ยว')).toBeLessThan(text.indexOf('ค่าน้ำมัน'))
  })

  it('falls back to a placeholder for items with no description', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 50,
      byCategory: [{ name: 'อื่นๆ', total: 50 }],
      items: [{ date: '2026-01-03', description: '', amount: 50, categoryName: 'อื่นๆ', memberName: 'พ่อ' }]
    })
    expect(text).toContain('ไม่มีรายละเอียด')
  })

  it('omits the item-detail section when there are no items', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 100,
      byCategory: [{ name: 'อื่นๆ', total: 100 }],
      items: []
    })
    expect(text).not.toContain('รายละเอียดรายการ')
    expect(text).toBe('อื่นๆ: 100\nTotal: 100')
  })
})
