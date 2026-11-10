import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import {
  addCreditCard,
  recordCardPayment,
  setCreditCardActive,
  updateCreditCard,
  voidCardPayment
} from '@/domain/services/creditCardService'
import { useCardSummaries } from '@/features/cards/useCardSummaries'
import { CardRangeSummary } from '@/features/cards/CardRangeSummary'
import type { CardSummary } from '@/domain/rules/creditCard'
import type { CardPayment, CreditCard } from '@/domain/entities/types'
import { AppError } from '@/shared/types/errors'
import { formatMoney } from '@/shared/formatting/money'
import { formatDateThai, formatDateRangeThai, todayIso } from '@/shared/formatting/date'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface FormState {
  name: string
  last4: string
  statementDay: string
  dueDay: string
  creditLimit: string
  ownerMemberId: string
}

const EMPTY_FORM: FormState = { name: '', last4: '', statementDay: '', dueDay: '', creditLimit: '', ownerMemberId: '' }

function toForm(c: CreditCard): FormState {
  return {
    name: c.name,
    last4: c.last4 ?? '',
    statementDay: String(c.statementDay),
    dueDay: String(c.dueDay),
    creditLimit: c.creditLimit !== undefined ? String(c.creditLimit) : '',
    ownerMemberId: c.ownerMemberId ?? ''
  }
}

function errorMessage(err: unknown): string {
  return err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ'
}

export function CreditCardsScreen() {
  const { household, activeMembers } = useHousehold()
  const toast = useToast()
  const data = useCardSummaries(household?.householdId)

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string>()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayIso())

  if (!household || !data) return <LoadingState />
  const currency = household.baseCurrency
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function startEdit(card?: CreditCard) {
    setError(undefined)
    setForm(card ? toForm(card) : EMPTY_FORM)
    setEditingId(card ? card.creditCardId : 'new')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!household) return
    setError(undefined)
    const input = {
      name: form.name,
      last4: form.last4.trim() || undefined,
      ownerMemberId: form.ownerMemberId || undefined,
      statementDay: Number(form.statementDay),
      dueDay: Number(form.dueDay),
      creditLimit: form.creditLimit.trim() ? Number(form.creditLimit) : undefined
    }
    try {
      if (editingId === 'new') await addCreditCard(household.householdId, input)
      else if (editingId) await updateCreditCard(editingId, input)
      toast.show('success', 'บันทึกบัตรเรียบร้อยแล้ว')
      setEditingId(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handlePay(e: FormEvent, card: CreditCard) {
    e.preventDefault()
    try {
      await recordCardPayment({ creditCardId: card.creditCardId, amount: Number(payAmount), paymentDate: payDate })
      toast.show('success', 'บันทึกการชำระบัตรแล้ว')
      setPayingId(null)
    } catch (err) {
      toast.show('error', errorMessage(err))
    }
  }

  function startPay(s: CardSummary) {
    setPayAmount(s.statementDue > 0 ? String(s.statementDue) : '')
    setPayDate(todayIso())
    setPayingId(s.card.creditCardId)
  }

  const paymentsByCard = (cardId: string): CardPayment[] =>
    data.payments
      .filter((p) => p.creditCardId === cardId && p.status === 'confirmed')
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .slice(0, 3)

  const sorted = [...data.summaries].sort(
    (a, b) => Number(b.card.status === 'active') - Number(a.card.status === 'active') || a.card.name.localeCompare(b.card.name)
  )

  return (
    <div className="screen">
      {editingId ? (
        <form className="form" onSubmit={handleSubmit}>
          <Field label="ชื่อบัตร" htmlFor="card-name" error={error}>
            <input id="card-name" className="input" required value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="เช่น KTC Visa" />
          </Field>
          <Field label="เลขท้าย 4 หลัก (ไม่บังคับ)" htmlFor="card-last4">
            <input id="card-last4" className="input" inputMode="numeric" maxLength={4} value={form.last4} onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="วันตัดรอบบิล (วันที่ของเดือน)" htmlFor="card-statement-day">
            <input id="card-statement-day" className="input" type="number" inputMode="numeric" min={1} max={31} required value={form.statementDay} onChange={(e) => set({ statementDay: e.target.value })} />
          </Field>
          <Field label="วันครบกำหนดชำระ (วันที่ของเดือน)" htmlFor="card-due-day" hint="ถ้าน้อยกว่าหรือเท่ากับวันตัดรอบ จะนับเป็นเดือนถัดไป">
            <input id="card-due-day" className="input" type="number" inputMode="numeric" min={1} max={31} required value={form.dueDay} onChange={(e) => set({ dueDay: e.target.value })} />
          </Field>
          <Field label="วงเงิน (ไม่บังคับ)" htmlFor="card-limit">
            <input id="card-limit" className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} />
          </Field>
          <Field label="เจ้าของบัตร (ไม่บังคับ)" htmlFor="card-owner">
            <select id="card-owner" className="input" value={form.ownerMemberId} onChange={(e) => set({ ownerMemberId: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {activeMembers.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </Field>
          <div className="form__actions">
            <Button type="button" variant="secondary" fullWidth onClick={() => setEditingId(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" fullWidth>
              บันทึก
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Button type="button" fullWidth onClick={() => startEdit()}>
            + เพิ่มบัตรเครดิต
          </Button>
          <Link to="/cards/import" className="btn btn--ghost btn--small">
            📩 นำเข้าจาก LINE / Statement ›
          </Link>
          <Link to="/cards/rules" className="btn btn--ghost btn--small">
            🏷️ กฎจัดหมวดหมู่ร้านค้า ›
          </Link>
        </>
      )}

      {sorted.length > 0 && <CardRangeSummary cards={sorted.map((s) => s.card)} />}

      {sorted.length === 0 ? (
        <EmptyState icon="💳" title="ยังไม่มีบัตรเครดิต" description="เพิ่มบัตรเพื่อเลือกตอนบันทึกค่าใช้จ่าย และดูยอดค้างชำระ" />
      ) : (
        sorted.map((s) => {
          const c = s.card
          const inactive = c.status !== 'active'
          return (
            <section key={c.creditCardId} className="card" style={{ opacity: inactive ? 0.6 : 1 }}>
              <h2 className="card__title">
                <span style={{ color: c.color }} aria-hidden="true">💳</span> {c.name}
                {c.last4 ? ` •••• ${c.last4}` : ''}
                {inactive ? ' (ปิดใช้งาน)' : ''}
              </h2>
              <p className="kpi-card__value">{formatMoney(s.outstanding, currency)}</p>
              <p>ยอดค้างชำระทั้งหมด{s.available !== undefined ? ` · วงเงินคงเหลือ ${formatMoney(s.available, currency)}` : ''}</p>
              <ul className="recent-list">
                <li className="recent-list__item">
                  <span className="recent-list__desc">
                    ยอดที่ต้องชำระ (ครบกำหนด {formatDateThai(s.dueDate)})
                    {s.overdue ? ' ⚠️ เกินกำหนด' : ''}
                  </span>
                  <span className="recent-list__amount">{formatMoney(s.statementDue, currency)}</span>
                </li>
                <li className="recent-list__item">
                  <span className="recent-list__desc">
                    ยอดรอบปัจจุบัน ({formatDateRangeThai(s.currentCycle.start, s.currentCycle.end)})
                  </span>
                  <span className="recent-list__amount">{formatMoney(s.unbilled, currency)}</span>
                </li>
              </ul>

              {payingId === c.creditCardId ? (
                <form className="form" onSubmit={(e) => void handlePay(e, c)}>
                  <Field label="จำนวนเงินที่ชำระ" htmlFor={`pay-amount-${c.creditCardId}`}>
                    <input id={`pay-amount-${c.creditCardId}`} className="input" type="number" inputMode="decimal" min={0.01} step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </Field>
                  <Field label="วันที่ชำระ" htmlFor={`pay-date-${c.creditCardId}`}>
                    <input id={`pay-date-${c.creditCardId}`} className="input" type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </Field>
                  <div className="form__actions">
                    <Button type="button" variant="secondary" fullWidth onClick={() => setPayingId(null)}>
                      ยกเลิก
                    </Button>
                    <Button type="submit" fullWidth>
                      บันทึกการชำระ
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="member-row__actions">
                  {!inactive && (
                    <button className="btn btn--ghost btn--small" onClick={() => startPay(s)}>
                      บันทึกการชำระบัตร
                    </button>
                  )}
                  <button className="btn btn--ghost btn--small" onClick={() => startEdit(c)}>
                    แก้ไข
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => void setCreditCardActive(c.creditCardId, inactive)}
                  >
                    {inactive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </button>
                </div>
              )}

              {paymentsByCard(c.creditCardId).length > 0 && (
                <ul className="recent-list">
                  {paymentsByCard(c.creditCardId).map((p) => (
                    <li key={p.cardPaymentId} className="recent-list__item">
                      <span className="recent-list__desc">ชำระ {formatDateThai(p.paymentDate)}</span>
                      <span className="recent-list__amount">{formatMoney(p.amount, currency)}</span>
                      <button
                        className="btn btn--ghost btn--small"
                        onClick={() => void voidCardPayment(p.cardPaymentId)}
                        aria-label="ยกเลิกรายการชำระ"
                      >
                        ยกเลิก
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
