import { useEffect, useState } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { getDashboardSummary, type DashboardSummary } from '@/domain/services/dashboardService'
import { formatMoney } from '@/shared/formatting/money'
import { formatMonthThai, todayIso } from '@/shared/formatting/date'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarList } from '@/components/charts/BarList'
import { SyncStatusBadge } from '@/components/ui/StatusBadge'

/** FR-006 Dashboard. */
export function DashboardScreen() {
  const { household, categories, members, loading: householdLoading } = useHousehold()
  const [summary, setSummary] = useState<DashboardSummary>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!household) return
    getDashboardSummary(household.householdId, household.monthStartDay, todayIso())
      .then(setSummary)
      .catch(() => setError('ไม่สามารถคำนวณสรุปได้ กรุณาลองโหลดข้อมูลใหม่'))
  }, [household])

  if (householdLoading || (!summary && !error)) return <LoadingState />
  if (error) return <EmptyState icon="⚠️" title={error} />
  if (!household || !summary) return null

  const currency = household.baseCurrency
  const delta = summary.totalThisPeriod - summary.totalPreviousPeriod
  const categoryItems = summary.byCategory
    .map((c) => {
      const cat = categories.find((x) => x.categoryId === c.categoryId)
      return { key: c.categoryId, label: cat?.name ?? 'ไม่ระบุหมวดหมู่', value: c.total, color: cat?.color ?? '#94a3b8' }
    })
    .sort((a, b) => b.value - a.value)
  const memberItems = summary.byMember
    .map((m) => {
      const mem = members.find((x) => x.memberId === m.memberId)
      return { key: m.memberId, label: mem?.displayName ?? 'ไม่ระบุ', value: m.total, color: mem?.color ?? '#94a3b8' }
    })
    .sort((a, b) => b.value - a.value)

  return (
    <div className="screen dashboard">
      <section className="card kpi-card">
        <p className="kpi-card__label">{formatMonthThai(summary.rangeStart)}</p>
        <p className="kpi-card__value">{formatMoney(summary.totalThisPeriod, currency)}</p>
        <p className={`kpi-card__delta ${delta >= 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down'}`}>
          {delta >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(delta), currency)} เทียบกับเดือนก่อน
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">ยอดตามหมวดหมู่</h2>
        {categoryItems.length === 0 ? (
          <EmptyState icon="🧾" title="ยังไม่มีรายการในเดือนนี้" />
        ) : (
          <BarList items={categoryItems} formatValue={(v) => formatMoney(v, currency)} />
        )}
      </section>

      <section className="card">
        <h2 className="card__title">ยอดที่แต่ละคนจ่าย</h2>
        {memberItems.length === 0 ? (
          <EmptyState icon="🙂" title="ยังไม่มีรายการในเดือนนี้" />
        ) : (
          <BarList items={memberItems} formatValue={(v) => formatMoney(v, currency)} />
        )}
      </section>

      <section className="card">
        <h2 className="card__title">รายการล่าสุด</h2>
        {summary.recent.length === 0 ? (
          <EmptyState icon="📭" title="ยังไม่มีรายการ" description="เริ่มบันทึกค่าใช้จ่ายแรกของคุณ" />
        ) : (
          <ul className="recent-list">
            {summary.recent.map((e) => (
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
