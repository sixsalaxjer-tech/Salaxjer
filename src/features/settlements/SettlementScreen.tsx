import { useEffect, useState, type FormEvent } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import {
  getSettlementSummary,
  listSettlements,
  recordSettlement,
  type SettlementSummary
} from '@/domain/services/settlementService'
import { clearWeek, listUnclearedWeeks, type UnclearedWeek } from '@/domain/services/weekSettlementService'
import { formatMoney } from '@/shared/formatting/money'
import { formatDateRangeThai, formatDateThai, todayIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import type { Settlement } from '@/domain/entities/types'
import type { SuggestedTransfer } from '@/domain/rules/settlement'

export function SettlementScreen() {
  const { household, members, loading: householdLoading } = useHousehold()
  const toast = useToast()
  const [summary, setSummary] = useState<SettlementSummary>()
  const [history, setHistory] = useState<Settlement[]>()
  const [unclearedWeeks, setUnclearedWeeks] = useState<UnclearedWeek[]>()
  const [clearingWeekStart, setClearingWeekStart] = useState<string>()
  const [error, setError] = useState<string>()
  const [form, setForm] = useState<{ fromMemberId: string; toMemberId: string; amount: string; note: string }>()

  async function reload() {
    if (!household) return
    try {
      const [s, h, w] = await Promise.all([
        getSettlementSummary(household.householdId, household.baseCurrency),
        listSettlements(household.householdId),
        listUnclearedWeeks(household.householdId)
      ])
      setSummary(s)
      setHistory(h)
      setUnclearedWeeks(w)
      setError(undefined)
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'ยอดเคลียร์ไม่สมดุล กรุณาตรวจสอบรายการปรับปรุง')
    }
  }

  async function handleClearWeek(week: UnclearedWeek) {
    if (!household || clearingWeekStart) return
    setClearingWeekStart(week.weekStart)
    try {
      await clearWeek({
        householdId: household.householdId,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        total: week.total
      })
      toast.show('success', 'เคลียร์ยอดสัปดาห์นี้แล้ว')
      await reload()
    } catch (err) {
      toast.show('error', err instanceof AppError ? err.userMessage : 'ทำรายการไม่สำเร็จ')
    } finally {
      setClearingWeekStart(undefined)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.householdId])

  function nameOf(memberId: string): string {
    return members.find((m) => m.memberId === memberId)?.displayName ?? 'ไม่ระบุ'
  }

  function openRecordForm(t?: SuggestedTransfer) {
    setForm({
      fromMemberId: t?.fromMemberId ?? members[0]?.memberId ?? '',
      toMemberId: t?.toMemberId ?? members[1]?.memberId ?? '',
      amount: t ? String(t.amount) : '',
      note: ''
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!household || !form) return
    try {
      await recordSettlement({
        householdId: household.householdId,
        fromMemberId: form.fromMemberId,
        toMemberId: form.toMemberId,
        amount: Number(form.amount),
        settlementDate: todayIso(),
        note: form.note || undefined
      })
      toast.show('success', 'บันทึกการโอนคืนแล้ว')
      setForm(undefined)
      await reload()
    } catch (err) {
      toast.show('error', err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  if (householdLoading || (!summary && !error)) return <LoadingState />
  if (error) return <EmptyState icon="⚠️" title={error} />
  if (!summary || !history || !unclearedWeeks || !household) return null

  return (
    <div className="screen settlement">
      <section className="card">
        <h2 className="card__title">ยอดคงเหลือของแต่ละคน</h2>
        <p className="card__hint">ไม่รวมสัปดาห์ที่กด "เคลียร์ยอด" แล้วในการ์ดสรุปรายสัปดาห์</p>
        {summary.balances.every((b) => Math.round(b.netAmount * 100) === 0) ? (
          <EmptyState icon="✅" title="ยอดเรียบร้อย ไม่มีใครค้างจ่าย" />
        ) : (
          <ul className="balance-list">
            {summary.balances.map((b) => (
              <li key={b.memberId} className="balance-list__item">
                <span>{nameOf(b.memberId)}</span>
                <span className={b.netAmount >= 0 ? 'balance-list__amount--positive' : 'balance-list__amount--negative'}>
                  {b.netAmount >= 0 ? 'ได้รับคืน ' : 'ต้องจ่าย '}
                  {formatMoney(Math.abs(b.netAmount), household.baseCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">สัปดาห์ที่ยังไม่ได้เคลียร์ยอด</h2>
        {unclearedWeeks.length === 0 ? (
          <EmptyState icon="✅" title="เคลียร์ยอดครบทุกสัปดาห์แล้ว" />
        ) : (
          <ul className="transfer-list">
            {unclearedWeeks.map((w) => (
              <li key={w.weekStart} className="transfer-list__item">
                <span>{formatDateRangeThai(w.weekStart, w.weekEnd)}</span>
                <span>{formatMoney(w.total, household.baseCurrency)}</span>
                <Button
                  variant="secondary"
                  disabled={clearingWeekStart === w.weekStart}
                  onClick={() => void handleClearWeek(w)}
                >
                  เคลียร์ยอด
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">คำแนะนำการโอน</h2>
        {summary.suggestedTransfers.length === 0 ? (
          <EmptyState icon="🎉" title="ไม่มีรายการที่ต้องโอน" />
        ) : (
          <ul className="transfer-list">
            {summary.suggestedTransfers.map((t, i) => (
              <li key={i} className="transfer-list__item">
                <span>
                  {nameOf(t.fromMemberId)} → {nameOf(t.toMemberId)}
                </span>
                <span>{formatMoney(t.amount, household.baseCurrency)}</span>
                <Button variant="secondary" onClick={() => openRecordForm(t)}>
                  บันทึกการโอน
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" onClick={() => openRecordForm()}>
          + บันทึกการโอนเอง
        </Button>
      </section>

      {form && (
        <section className="card">
          <h2 className="card__title">บันทึกการชำระคืน</h2>
          <form className="form" onSubmit={handleSubmit}>
            <Field label="ผู้จ่าย" htmlFor="from-member">
              <select
                id="from-member"
                className="input"
                value={form.fromMemberId}
                onChange={(e) => setForm({ ...form, fromMemberId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ผู้รับ" htmlFor="to-member">
              <select
                id="to-member"
                className="input"
                value={form.toMemberId}
                onChange={(e) => setForm({ ...form, toMemberId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="จำนวนเงิน" htmlFor="settlement-amount">
              <input
                id="settlement-amount"
                className="input"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="หมายเหตุ" htmlFor="settlement-note">
              <input
                id="settlement-note"
                className="input"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <div className="form__actions">
              <Button type="button" variant="ghost" fullWidth onClick={() => setForm(undefined)}>
                ยกเลิก
              </Button>
              <Button type="submit" fullWidth>
                บันทึก
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">ประวัติการชำระ</h2>
        {history.length === 0 ? (
          <EmptyState icon="🧾" title="ยังไม่มีประวัติการชำระ" />
        ) : (
          <ul className="tx-list">
            {history.map((s) => (
              <li key={s.settlementId} className="tx-item">
                <div className="tx-item__main">
                  <div className="tx-item__info">
                    <span className="tx-item__desc">
                      {nameOf(s.fromMemberId)} → {nameOf(s.toMemberId)}
                    </span>
                    <span className="tx-item__meta">
                      {formatDateThai(s.settlementDate)} {s.note ? `· ${s.note}` : ''}
                    </span>
                  </div>
                  <span className="tx-item__amount">{formatMoney(s.amount, household.baseCurrency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
