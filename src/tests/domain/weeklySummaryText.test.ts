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
  it('matches the requested format: อาหาร/เดินทาง collapse to one total line, every other category is itemized as "name description amount"', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 2814,
      rangeStart: '2026-09-21',
      rangeEnd: '2026-09-27',
      byCategory: [
        { name: 'อาหาร', total: 1302 },
        { name: 'บ้าน', total: 895 },
        { name: 'เสื้อผ้า', total: 195 },
        { name: 'สุขภาพและความงาม', total: 291 },
        { name: 'สาธารณูปโภค', total: 36 },
        { name: 'เดินทาง', total: 95 }
      ],
      items: [
        { amount: 152, description: 'Pipeline', categoryName: 'บ้าน' },
        { amount: 180, description: 'ตะไบ', categoryName: 'บ้าน' },
        { amount: 410, description: 'Water Pump', categoryName: 'บ้าน' },
        { amount: 153, description: 'Waterproof tape', categoryName: 'บ้าน' },
        { amount: 195, description: 'Jersey', categoryName: 'เสื้อผ้า' },
        { amount: 291, description: 'เครื่องเป่าลมร้อน', categoryName: 'สุขภาพและความงาม' },
        { amount: 36, description: 'ค่าน้ำ', categoryName: 'สาธารณูปโภค' }
      ]
    })

    expect(text).toBe(
      [
        'รายละเอียดรายการ วันที่ 21-27 ก.ย.',
        'อาหาร 1,302',
        'บ้าน Pipeline 152',
        'บ้าน ตะไบ 180',
        'บ้าน Water Pump 410',
        'บ้าน Waterproof tape 153',
        'เสื้อผ้า Jersey 195',
        'สุขภาพและความงาม เครื่องเป่าลมร้อน 291',
        'สาธารณูปโภค ค่าน้ำ 36',
        'เดินทาง 95',
        'รวม 2,814'
      ].join('\n')
    )
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

  it('shows a zero total line for อาหาร/เดินทาง with no items in range', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 0,
      rangeStart: '2026-09-14',
      rangeEnd: '2026-09-20',
      byCategory: [{ name: 'อาหาร', total: 0 }],
      items: []
    })

    expect(text).toBe(['รายละเอียดรายการ วันที่ 14-20 ก.ย.', 'อาหาร 0', 'รวม 0'].join('\n'))
  })

  it('produces no lines for a non-summed category with no items in range', () => {
    const text = buildWeeklySummaryDetailedText({
      total: 100,
      rangeStart: '2026-09-14',
      rangeEnd: '2026-09-20',
      byCategory: [{ name: 'บ้าน', total: 100 }],
      items: []
    })

    expect(text).toBe(['รายละเอียดรายการ วันที่ 14-20 ก.ย.', 'รวม 100'].join('\n'))
  })
})
