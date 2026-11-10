import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCardSummaries } from '@/features/cards/useCardSummaries'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { getDashboardSummary, getPeriodBreakdown, type PaymentMethod, type PeriodBreakdown } from '@/domain/services/dashboardService'
import type { Expense } from '@/domain/entities/types'
import { formatMoney } from '@/shared/formatting/money'
import {
  addDays,
  addMonths,
  addYears,
  formatDateThai,
  formatMonthThai,
  formatYearThai,
  getMonthRange,
  getYearRange,
  todayIso
} from '@/shared/formatting/date'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarList } from '@/components/charts/BarList'
import { SyncStatusBadge } from '@/components/ui/StatusBadge'
import { WeeklySummaryCard } from '@/features/dashboard/WeeklySummaryCard'

type ViewMode = 'month' | 'year'

/** FR-006 Dashboard, with a month/year total filter (default: current month). */
export function DashboardScreen() {
  const { household, categories, members, loading: householdLoading } = useHousehold()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [offset, setOffset] = useState(0)
  const [period, setPeriod] = useState<PeriodBreakdown>()
  const [prevTotal, setPrevTotal] = useState(0)
  const [recent, setRecent] = useState<Expense[]>([])
  const [error, setError] = useState<string>()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const cardsData = useCardSummaries(household?.householdId)
  const activeCards = (cardsData?.summaries ?? []).filter((s) => s.card.status === 'active')

  const anchorDate = viewMode === 'month' ? addMonths(todayIso(), offset) : addYears(todayIso(), offset)
  const [rangeStart, rangeEnd] = household
    ? viewMode === 'month'
      ? getMonthRange(anchorDate, household.monthStartDay)
      : getYearRange(anchorDate)
    : ['', '']
  const prevAnchor = addDays(rangeStart, -1)
  const [prevStart, prevEnd] = household
    ? viewMode === 'month'
      ? getMonthRange(prevAnchor, household.monthStartDay)
      : getYearRange(prevAnchor)
    : ['', '']

  useEffect(() => {
    if (!household || !rangeStart) return
    setPeriod(undefined)
    setError(undefined)
    Promise.all([
      getPeriodBreakdown(household.householdId, rangeStart, rangeEnd, method),
      getPeriodBreakdown(household.householdId, prevStart, prevEnd, method)
    ])
      .then(([current, prev]) => {
        setPeriod(current)
        setPrevTotal(prev.total)
      })
      .catch(() => setError('ไม่สามารถคำนวณสรุปได้ กรุณาลองโหลดข้อมูลใหม่'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.householdId, rangeStart, rangeEnd, prevStart, prevEnd, method])

  useEffect(() => {
    if (!household) return
    getDashboardSummary(household.householdId, household.monthStartDay, todayIso())
      .then((s) => setRecent(s.recent))
      .catch(() => {})
  }, [household])

  if (householdLoading || (!period && !error)) return <LoadingState />
  if (error) return <EmptyState icon="⚠️" title={error} />
  if (!household || !period) return null

  const currency = household.baseCurrency
  const delta = period.total - prevTotal
  const periodLabel = viewMode === 'month' ? formatMonthThai(rangeStart) : formatYearThai(rangeStart)
  const categoryItems = period.byCategory
    .map((c) => {
      const cat = categories.find((x) => x.categoryId === c.categoryId)
      return { key: c.categoryId, label: cat?.name ?? 'ไม่ระบุหมวดหมู่', value: c.total, color: cat?.color ?? '#94a3b8' }
    })
    .sort((a, b) => b.value - a.value)
  const memberItems = period.byMember
    .map((m) => {
      const mem = members.find((x) => x.memberId === m.memberId)
      return { key: m.memberId, label: mem?.displayName ?? 'ไม่ระบุ', value: m.total, color: mem?.color ?? '#94a3b8' }
    })
    .sort((a, b) => b.value - a.value)

  return (
    <div className="screen dashboard">
      <div className="segmented" role="radiogroup" aria-label="วิธีจ่าย">
        {(['cash', 'card'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            className={`segmented__option${method === m ? ' segmented__option--active' : ''}`}
            onClick={() => setMethod(m)}
          >
            {m === 'cash' ? '💵 เงินสด/อื่นๆ' : '💳 บัตรเครดิต'}
          </button>
        ))}
      </div>

      <section className="card kpi-card">
        <div className="segmented" role="radiogroup" aria-label="มุมมองช่วงเวลา">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'month'}
            className={`segmented__option${viewMode === 'month' ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setViewMode('month')
              setOffset(0)
            }}
          >
            รายเดือน
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'year'}
            className={`segmented__option${viewMode === 'year' ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setViewMode('year')
              setOffset(0)
            }}
          >
            รายปี
          </button>
        </div>

        <div className="week-nav">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="ช่วงก่อนหน้า"
          >
            ‹ ก่อนหน้า
          </button>
          <span className="week-nav__label">{periodLabel}</span>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label="ช่วงถัดไป"
          >
            ถัดไป ›
          </button>
        </div>

        <p className="kpi-card__value">{formatMoney(period.total, currency)}</p>
        <p className={`kpi-card__delta ${delta >= 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down'}`}>
          {delta >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(delta), currency)} เทียบกับ{viewMode === 'month' ? 'เดือนก่อน' : 'ปีก่อน'}
        </p>
      </section>

      <WeeklySummaryCard method={method} />

      {activeCards.length > 0 && (
        <section className="card">
          <h2 className="card__title">💳 บัตรเครดิต</h2>
          <ul className="recent-list">
            {activeCards.map((s) => (
              <li key={s.card.creditCardId} className="recent-list__item">
                <span className="recent-list__desc">
                  {s.card.name}
                  {s.statementDue > 0 && ` · ครบกำหนด ${formatDateThai(s.dueDate)}${s.overdue ? ' ⚠️' : ''}`}
                </span>
                <span className="recent-list__amount">{formatMoney(s.outstanding, currency)}</span>
              </li>
            ))}
          </ul>
          <Link to="/cards" className="btn btn--ghost btn--small">
            จัดการบัตรและบันทึกการชำระ ›
          </Link>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">ยอดตามหมวดหมู่</h2>
        {categoryItems.length === 0 ? (
          <EmptyState icon="🧾" title="ยังไม่มีรายการในช่วงนี้" />
        ) : (
          <BarList items={categoryItems} formatValue={(v) => formatMoney(v, currency)} />
        )}
      </section>

      <section className="card">
        <h2 className="card__title">ยอดที่แต่ละคนจ่าย</h2>
        {memberItems.length === 0 ? (
          <EmptyState icon="🙂" title="ยังไม่มีรายการในช่วงนี้" />
        ) : (
          <BarList items={memberItems} formatValue={(v) => formatMoney(v, currency)} />
        )}
      </section>

      <section className="card">
        <h2 className="card__title">รายการล่าสุด</h2>
        {recent.length === 0 ? (
          <EmptyState icon="📭" title="ยังไม่มีรายการ" description="เริ่มบันทึกค่าใช้จ่ายแรกของคุณ" />
        ) : (
          <ul className="recent-list">
            {recent.map((e) => (
              <li key={e.expenseId} className="recent-list__item">
                <span className="recent-list__desc">{e.description || 'ไม่มีรายละเอียด'}</span>
                <span className="recent-list__amount">{formatMoney(e.amount, e.currency)}</span>
                <SyncStatusBadge status={e.syncStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
