export interface BarListItem {
  key: string
  label: string
  value: number
  color: string
}

/**
 * Lightweight, dependency-free horizontal bar list (spec suggests a "Lightweight Chart Library" —
 * for the MVP's simple category/member totals, plain SVG bars avoid pulling in a charting package).
 */
export function BarList({ items, formatValue }: { items: BarListItem[]; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div key={item.key} className="bar-list__row">
          <span className="bar-list__label">{item.label}</span>
          <div className="bar-list__track">
            <div
              className="bar-list__fill"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="bar-list__value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  )
}
