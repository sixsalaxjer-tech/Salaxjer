import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { db } from '@/infrastructure/db/db'
import { createExpense } from '@/domain/services/expenseService'
import { parseCardNotifications } from '@/domain/rules/cardNotification'
import { resolveMerchant } from '@/domain/rules/merchantRules'
import { formatMoney } from '@/shared/formatting/money'
import { formatDateThai, todayIso } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

const keyFor = (cardId: string, fingerprint: string) => `card-notify:${cardId}:${fingerprint}`

/** Paste card-spend notifications forwarded from LINE; review; import as expenses on the matching card. */
export function ImportCardNotificationsScreen() {
  const { household, activeMembers, activeCategories } = useHousehold()
  const toast = useToast()
  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [payerId, setPayerId] = useState('')
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const cards = useLiveQuery(
    () => (household ? db.creditCards.where('householdId').equals(household.householdId).toArray() : []),
    [household?.householdId]
  )
  const parsed = useMemo(() => parseCardNotifications(text, todayIso()), [text])
  const cardByLast4 = (last4: string) => (cards ?? []).find((c) => c.status === 'active' && c.last4 === last4)

  const rows = parsed.map((p) => ({ p, card: cardByLast4(p.last4) }))
  const keys = rows.filter((r) => r.card).map((r) => keyFor(r.card!.creditCardId, r.p.fingerprint))
  const existingKeys = useLiveQuery(
    async () => new Set((await db.expenses.where('idempotencyKey').anyOf(keys).toArray()).map((e) => e.idempotencyKey)),
    [keys.join(',')]
  )

  if (!household) return null
  const effectiveCategory = categoryId || activeCategories[0]?.categoryId || ''

  /** Rule-based category (e.g. BTS -> เดินทาง) when the household has it, else the on-screen default. */
  function categoryFor(merchant: string): string {
    const name = resolveMerchant(merchant).categoryName
    return activeCategories.find((c) => c.name === name)?.categoryId ?? effectiveCategory
  }

  const importable = rows.filter(
    (r) => r.card && !skipped.has(r.p.fingerprint) && !existingKeys?.has(keyFor(r.card.creditCardId, r.p.fingerprint))
  )

  async function handleImport() {
    if (!household) return
    setBusy(true)
    let ok = 0
    try {
      for (const { p, card } of importable) {
        const payer = payerId || card!.ownerMemberId || activeMembers[0]?.memberId
        await createExpense({
          householdId: household.householdId,
          expenseDate: p.date,
          amount: p.amount,
          currency: household.baseCurrency,
          categoryId: categoryFor(p.merchant),
          paidByMemberId: payer,
          expenseType: 'personal',
          description: resolveMerchant(p.merchant).description,
          tags: ['line-import'],
          status: 'active',
          allocationType: 'equal',
          allocationEntries: [],
          creditCardId: card!.creditCardId,
          // Same notification => same key, so re-pasting never creates duplicates.
          idempotencyKey: keyFor(card!.creditCardId, p.fingerprint)
        })
        ok++
      }
      toast.show('success', `นำเข้า ${ok} รายการแล้ว`)
      setText('')
      setSkipped(new Set())
    } catch (err) {
      toast.show('error', `นำเข้าได้ ${ok} รายการ แล้วหยุด: ${err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <Field label="วางข้อความแจ้งเตือนจาก LINE" htmlFor="notify-text" hint="วางได้หลายรายการพร้อมกัน ทั้งภาษาไทย/อังกฤษ">
          <textarea id="notify-text" className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="หมวดหมู่เริ่มต้น (ใช้เมื่อไม่รู้จักร้าน)" htmlFor="notify-category">
          <select id="notify-category" className="input" value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)}>
            {activeCategories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ผู้จ่าย" htmlFor="notify-payer">
          <select id="notify-payer" className="input" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            <option value="">เจ้าของบัตร (ถ้าไม่ระบุ ใช้คนแรก)</option>
            {activeMembers.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </Field>
      </form>

      {text.trim() && rows.length === 0 && <EmptyState icon="🔍" title="ไม่พบรายการใช้บัตรในข้อความ" />}

      {rows.length > 0 && (
        <ul className="recent-list">
          {rows.map(({ p, card }) => {
            const dup = card && existingKeys?.has(keyFor(card.creditCardId, p.fingerprint))
            const off = skipped.has(p.fingerprint)
            return (
              <li key={p.fingerprint} className="recent-list__item">
                <label className="recent-list__desc">
                  <input
                    type="checkbox"
                    disabled={!card || Boolean(dup)}
                    checked={Boolean(card) && !dup && !off}
                    onChange={() =>
                      setSkipped((s) => {
                        const n = new Set(s)
                        if (n.has(p.fingerprint)) n.delete(p.fingerprint)
                        else n.add(p.fingerprint)
                        return n
                      })
                    }
                  />{' '}
                  {formatDateThai(p.date)} · {resolveMerchant(p.merchant).description}
                  <br />
                  <small>
                    {card
                      ? `💳 ${card.name} •••• ${p.last4} · ${activeCategories.find((c) => c.categoryId === categoryFor(p.merchant))?.name ?? ''}` : `⚠️ ไม่พบบัตรเลขท้าย ${p.last4} — เพิ่มบัตรก่อน`}
                    {dup ? ' · นำเข้าแล้ว' : ''}
                  </small>
                </label>
                <span className="recent-list__amount">{formatMoney(p.amount, household.baseCurrency)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <Button type="button" fullWidth disabled={busy || importable.length === 0 || !effectiveCategory} onClick={() => void handleImport()}>
        {busy ? 'กำลังนำเข้า...' : `นำเข้า ${importable.length} รายการ`}
      </Button>
    </div>
  )
}
