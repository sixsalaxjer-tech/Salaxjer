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
  it('builds a header with the date range, one "Category amt+amt" line per category, and a รวม total', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 1150,
      rangeStart: '2026-09-14',
      rangeEnd: '2026-09-20',
      byCategory: [
        { name: 'อาหาร', total: 850 },
        { name: 'เดินทาง', total: 300 }
      ],
      items: [
        { amount: 500, categoryName: 'อาหาร' },
        { amount: 350, categoryName: 'อาหาร' },
        { amount: 300, categoryName: 'เดินทาง' }
      ]
    })

    expect(text).toBe(['รายละเอียดรายการ วันที่ 14-20 ก.ย.', 'อาหาร 500+350', 'เดินทาง 300', 'รวม 1,150'].join('\n'))
  })

  it('spans months in the header when the week crosses a month boundary', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 0,
      rangeStart: '2026-08-31',
      rangeEnd: '2026-09-06',
      byCategory: [],
      items: []
    })

    expect(text.split('\n')[0]).toBe('รายละเอียดรายการ วันที่ 31 ส.ค.-6 ก.ย.')
  })

  it('shows an empty amount list for a category with no items in range', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 100,
      rangeStart: '2026-09-14',
      rangeEnd: '2026-09-20',
      byCategory: [{ name: 'อื่นๆ', total: 100 }],
      items: []
    })

    expect(text).toBe(['รายละเอียดรายการ วันที่ 14-20 ก.ย.', 'อื่นๆ ', 'รวม 100'].join('\n'))
  })
})
