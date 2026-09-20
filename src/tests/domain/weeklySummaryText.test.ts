import { describe, expect, it } from 'vitest'
import { buildWeeklySummaryText } from '@/domain/rules/weeklySummaryText'

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
