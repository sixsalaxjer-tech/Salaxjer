import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { db } from '@/infrastructure/db/db'
import { getStatementCycle, getPreviousCycle, summarizeCardRange } from '@/domain/rules/creditCard'
import { buildWeeklySummaryDetailedText, buildWeeklySummaryText } from '@/domain/rules/weeklySummaryText'
import { addDays, addMonths, formatDateRangeThai, getMonthRange, getWeekRange, todayIso } from '@/shared/formatting/date'
import { formatMoney } from '@/shared/formatting/money'
import { BarList } from '@/components/charts/BarList'
import { Button } from '@/components/ui/Button'
import type { CreditCard } from '@/domain/entities/types'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText

interface Preset {
  key: string
  label: string
  range: () => [string, string]
}

/** Pick any date range (across weeks, months or statement cycles) and see what was charged to cards. */
export function CardRangeSummary({ cards }: { cards: CreditCard[] }) {
  const { household, categories } = useHousehold()
  const toast = useToast()
  const today = todayIso()
  const [from, setFrom] = useState(() => getMonthRange(today, household?.monthStartDay ?? 1)[0])
  const [to, setTo] = useState(today)
  const [cardId, setCardId] = useState('')
  const [format, setFormat] = useState<'simple' | 'detailed'>('simple')
  const [open, setOpen] = useState(false)

  const expenses = useLiveQuery(
    () => (household ? db.expenses.where('householdId').equals(household.householdId).toArray() : []),
    [household?.householdId]
  )

  const summary = useMemo(
    () => summarizeCardRange(expenses ?? [], { from, to, creditCardId: cardId || undefined }),
    [expenses, from, to, cardId]
  )

  if (!household) return null
  const currency = household.baseCurrency
  const monthStartDay = household.monthStartDay
  const selected = cards.find((c) => c.creditCardId === cardId)

  const presets: Preset[] = [
    { key: 'week', label: 'สัปดาห์นี้', range: () => getWeekRange(today) },
    { key: 'lastWeek', label: 'สัปดาห์ก่อน', range: () => getWeekRange(addDays(today, -7)) },
    { key: 'month', label: 'เดือนนี้', range: () => getMonthRange(today, monthStartDay) },
    { key: 'lastMonth', label: 'เดือนก่อน', range: () => getMonthRange(addMonths(today, -1), monthStartDay) },
    ...(selected
      ? [
          {
            key: 'cycle',
            label: 'รอบบิลปัจจุบัน',
            range: () => {
              const c = getStatementCycle(today, selected.statementDay)
              return [c.start, c.end] as [string, string]
            }
          },
          {
            key: 'lastCycle',
            label: 'รอบบิลที่แล้ว',
            range: () => {
              const c = getPreviousCycle(today, selected.statementDay)
              return [c.start, c.end] as [string, string]
            }
          }
        ]
      : [])
  ]

  function applyPreset(p: Preset) {
    const [f, t] = p.range()
    setFrom(f)
    setTo(t)
  }

  const cardName = (id: string) => cards.find((c) => c.creditCardId === id)?.name ?? 'ไม่ระบุบัตร'
  const categoryItems = summary.byCategory
    .map((c) => {
      const cat = categories.find((x) => x.categoryId === c.categoryId)
      return { key: c.categoryId, label: cat?.name ?? 'ไม่ระบุหมวดหมู่', value: c.total, color: cat?.color ?? '#94a3b8' }
    })
    .sort((a, b) => b.value - a.value)
  const cardItems = summary.byCard
    .map((c) => ({
      key: c.creditCardId,
      label: cardName(c.creditCardId),
      value: c.total,
      color: cards.find((x) => x.creditCardId === c.creditCardId)?.color ?? '#2563eb'
    }))
    .sort((a, b) => b.value - a.value)

  const text = (() => {
    const lineCats = summary.byCategory.map((c) => ({
      name: categories.find((x) => x.categoryId === c.categoryId)?.name ?? 'ไม่ระบุหมวดหมู่',
      total: c.total
    }))
    const items = summary.items.map((e) => ({
      amount: e.amount,
      description: e.description,
      categoryName: categories.find((x) => x.categoryId === e.categoryId)?.name ?? 'ไม่ระบุหมวดหมู่'
    }))
    return format === 'simple'
      ? buildWeeklySummaryText({
          total: summary.total,
          byCategory: lineCats,
          items,
          rangeStart: summary.from,
          rangeEnd: summary.to,
          methodLabel: selected ? `บัตร ${selected.name}` : 'บัตรเครดิต'
        })
      : buildWeeklySummaryDetailedText({ byCategory: lineCats, items })
  })()

  async function handleShare() {
    try {
      await navigator.share({ text })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.show('error', 'แชร์ไม่สำเร็จ')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.show('success', 'คัดลอกข้อความแล้ว')
    } catch {
      toast.show('error', 'คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง')
    }
  }

  return (
    <section className="card">
      <h2 className="card__title">📅 สรุปยอดบัตรตามช่วงวันที่</h2>

      <div className="inline-fields">
        <input className="input" type="date" aria-label="ตั้งแต่วันที่" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <input className="input" type="date" aria-label="ถึงวันที่" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </div>

      <div className="member-row__actions">
        {presets.map((p) => (
          <button key={p.key} type="button" className="btn btn--ghost btn--small" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <select className="input" aria-label="บัตร" value={cardId} onChange={(e) => setCardId(e.target.value)}>
        <option value="">ทุกบัตร</option>
        {cards.map((c) => (
          <option key={c.creditCardId} value={c.creditCardId}>
            {c.name}
            {c.last4 ? ` •••• ${c.last4}` : ''}
          </option>
        ))}
      </select>

      <p className="kpi-card__value">{formatMoney(summary.total, currency)}</p>
      <p>
        {formatDateRangeThai(summary.from, summary.to)} · {summary.count} รายการ
      </p>

      {summary.count > 0 && (
        <>
          {!selected && cardItems.length > 1 && (
            <>
              <h3 className="card__title">ตามบัตร</h3>
              <BarList items={cardItems} formatValue={(v) => formatMoney(v, currency)} />
            </>
          )}
          <h3 className="card__title">ตามหมวดหมู่</h3>
          <BarList items={categoryItems} formatValue={(v) => formatMoney(v, currency)} />

          <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen((o) => !o)}>
            {open ? 'ซ่อนข้อความสรุป ▲' : 'ข้อความสรุปสำหรับแชร์ ▼'}
          </button>
          {open && (
            <>
              <div className="segmented" role="radiogroup" aria-label="รูปแบบสรุป">
                {(['simple', 'detailed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    className={`segmented__option${format === f ? ' segmented__option--active' : ''}`}
                    onClick={() => setFormat(f)}
                  >
                    {f === 'simple' ? 'แบบย่อ' : 'แบบละเอียด'}
                  </button>
                ))}
              </div>
              <pre className="weekly-summary__preview">{text}</pre>
              <div className="form__actions">
                {canShare && (
                  <Button fullWidth onClick={() => void handleShare()}>
                    แชร์
                  </Button>
                )}
                {canCopy && (
                  <Button variant={canShare ? 'secondary' : 'primary'} fullWidth onClick={() => void handleCopy()}>
                    คัดลอกข้อความ
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
