import { useEffect, useMemo, useState } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { getPeriodBreakdown, type PeriodBreakdown } from '@/domain/services/dashboardService'
import { buildWeeklySummaryText, buildWeeklySummaryDetailedText } from '@/domain/rules/weeklySummaryText'
import { addDays, formatDateRangeThai, getWeekRange, todayIso } from '@/shared/formatting/date'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText

/**
 * Weekly plain-text expense summary, meant to be shared into a chat app (e.g. LINE) by hand —
 * requested as a lightweight alternative to a full export. Offers a choice between a short
 * category/total format and a detailed one with a per-item breakdown, kept as separate builders
 * (see weeklySummaryText.ts) rather than merged into one. Uses the Web Share API when the
 * browser/OS supports it (opens the native share sheet, which lists LINE if installed), and
 * always offers "copy to clipboard" as a universally-supported fallback.
 */
export function WeeklySummaryCard() {
  const { household, categories, members, loading: householdLoading } = useHousehold()
  const toast = useToast()
  const [weekOffset, setWeekOffset] = useState(0)
  const [format, setFormat] = useState<'simple' | 'detailed'>('simple')
  const [breakdown, setBreakdown] = useState<PeriodBreakdown>()
  const [error, setError] = useState<string>()

  const anchorDate = addDays(todayIso(), weekOffset * 7)
  const [rangeStart, rangeEnd] = getWeekRange(anchorDate)

  useEffect(() => {
    if (!household) return
    setBreakdown(undefined)
    setError(undefined)
    getPeriodBreakdown(household.householdId, rangeStart, rangeEnd)
      .then(setBreakdown)
      .catch(() => setError('ไม่สามารถคำนวณสรุปได้ กรุณาลองโหลดข้อมูลใหม่'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.householdId, rangeStart, rangeEnd])

  const summaryText = useMemo(() => {
    if (!breakdown) return ''
    const byCategory = breakdown.byCategory.map((c) => {
      const category = categories.find((x) => x.categoryId === c.categoryId)
      return { name: category?.name ?? 'ไม่ระบุหมวดหมู่', total: c.total }
    })

    if (format === 'simple') {
      return buildWeeklySummaryText({ total: breakdown.total, byCategory })
    }

    return buildWeeklySummaryDetailedText({
      total: breakdown.total,
      byCategory,
      items: breakdown.items.map((e) => {
        const category = categories.find((x) => x.categoryId === e.categoryId)
        const member = members.find((x) => x.memberId === e.paidByMemberId)
        return {
          date: e.expenseDate,
          description: e.description,
          amount: e.amount,
          categoryName: category?.name ?? 'ไม่ระบุหมวดหมู่',
          memberName: member?.displayName ?? 'ไม่ระบุ'
        }
      })
    })
  }, [breakdown, categories, members, format])

  async function handleShare() {
    try {
      await navigator.share({ text: summaryText })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.show('error', 'แชร์ไม่สำเร็จ')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText)
      toast.show('success', 'คัดลอกข้อความแล้ว พร้อมวางในไลน์')
    } catch {
      toast.show('error', 'คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง')
    }
  }

  if (householdLoading) return null

  return (
    <section className="card">
      <h2 className="card__title">สรุปยอดรายสัปดาห์ (สำหรับแชร์)</h2>
      <div className="week-nav">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="สัปดาห์ก่อนหน้า"
        >
          ‹ ก่อนหน้า
        </button>
        <span className="week-nav__label">{formatDateRangeThai(rangeStart, rangeEnd)}</span>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
          disabled={weekOffset >= 0}
          aria-label="สัปดาห์ถัดไป"
        >
          ถัดไป ›
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="รูปแบบสรุป">
        <button
          type="button"
          role="radio"
          aria-checked={format === 'simple'}
          className={`segmented__option${format === 'simple' ? ' segmented__option--active' : ''}`}
          onClick={() => setFormat('simple')}
        >
          แบบย่อ
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={format === 'detailed'}
          className={`segmented__option${format === 'detailed' ? ' segmented__option--active' : ''}`}
          onClick={() => setFormat('detailed')}
        >
          แบบละเอียด
        </button>
      </div>

      {error ? (
        <EmptyState icon="⚠️" title={error} />
      ) : !breakdown ? (
        <LoadingState label="กำลังคำนวณ..." />
      ) : (
        <>
          <pre className="weekly-summary__preview">{summaryText}</pre>
          <div className="form__actions">
            {canShare && (
              <Button variant="primary" fullWidth onClick={() => void handleShare()}>
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
    </section>
  )
}
