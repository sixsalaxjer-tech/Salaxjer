import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { createExpense, listDescriptionSuggestionsByCategory } from '@/domain/services/expenseService'
import { parseAmountList } from '@/domain/rules/batchAmount'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/shared/formatting/money'
import { todayIso } from '@/shared/formatting/date'

type BatchType = 'personal' | 'income'

const BATCH_TYPE_LABELS: Record<BatchType, string> = {
  personal: 'ส่วนตัว',
  income: 'รายได้'
}

interface BatchRow {
  id: string
  categoryId: string
  expenseType: BatchType
  description: string
  amountsText: string
}

function makeRow(defaultCategoryId: string): BatchRow {
  return { id: uuidv4(), categoryId: defaultCategoryId, expenseType: 'personal', description: '', amountsText: '' }
}

/**
 * Batch entry: one shared date + payer, then any number of rows (category, description, and an
 * amount field that accepts "15+15+15+15" to create several same-category records at once). This
 * intentionally only supports Personal/Income — Shared/Advance/Household need a per-expense
 * allocation editor that would not fit a rapid multi-row flow; Adjustment needs a required reason
 * per record. Those still go through the regular single-entry form.
 */
export function BatchExpenseForm() {
  const { household, activeMembers, activeCategories } = useHousehold()
  const navigate = useNavigate()
  const toast = useToast()

  const [expenseDate, setExpenseDate] = useState(todayIso())
  const [paidByMemberId, setPaidByMemberId] = useState(activeMembers[0]?.memberId ?? '')
  const [rows, setRows] = useState<BatchRow[]>([makeRow(activeCategories[0]?.categoryId ?? '')])
  const [submitting, setSubmitting] = useState(false)
  const [descriptionSuggestionsByCategory, setDescriptionSuggestionsByCategory] = useState<Record<string, string[]>>(
    {}
  )

  useEffect(() => {
    if (!household) return
    listDescriptionSuggestionsByCategory(household.householdId).then(setDescriptionSuggestionsByCategory)
  }, [household?.householdId])

  function updateRow(id: string, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow(activeCategories[0]?.categoryId ?? '')])
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  const parsedRows = useMemo(() => rows.map((r) => ({ ...r, amounts: parseAmountList(r.amountsText) })), [rows])
  const totalCount = parsedRows.reduce((sum, r) => sum + r.amounts.length, 0)
  const totalAmount = parsedRows.reduce((sum, r) => sum + r.amounts.reduce((a, b) => a + b, 0), 0)
  const currency = household?.baseCurrency ?? 'THB'

  async function handleSubmit() {
    if (!household || totalCount === 0) return
    setSubmitting(true)
    let success = 0
    let failed = 0
    for (const row of parsedRows) {
      if (!row.categoryId || row.amounts.length === 0) continue
      for (const amount of row.amounts) {
        try {
          await createExpense({
            householdId: household.householdId,
            expenseDate,
            amount,
            currency: household.baseCurrency,
            categoryId: row.categoryId,
            paidByMemberId,
            expenseType: row.expenseType,
            description: row.description,
            tags: [],
            status: 'active',
            allocationType: 'equal',
            allocationEntries: [],
            idempotencyKey: uuidv4()
          })
          success++
        } catch {
          failed++
        }
      }
    }
    setSubmitting(false)
    if (success > 0) {
      toast.show(
        failed === 0 ? 'success' : 'error',
        failed === 0 ? `บันทึกสำเร็จ ${success} รายการ` : `บันทึกสำเร็จ ${success} รายการ, ล้มเหลว ${failed} รายการ`
      )
      navigate('/transactions')
    } else {
      toast.show('error', 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล')
    }
  }

  return (
    <div className="screen batch-form">
      <Field label="วันที่ (ใช้กับทุกรายการ)" htmlFor="batch-date">
        <input
          id="batch-date"
          type="date"
          className="input"
          required
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />
      </Field>

      <Field label="ผู้จ่าย (ใช้กับทุกรายการ)" htmlFor="batch-payer">
        <select
          id="batch-payer"
          className="input"
          value={paidByMemberId}
          onChange={(e) => setPaidByMemberId(e.target.value)}
        >
          {activeMembers.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.displayName}
            </option>
          ))}
        </select>
      </Field>

      <p className="field__hint">
        รองรับเฉพาะรายการส่วนตัวและรายได้ — สำหรับรายการร่วมกัน สำรองจ่าย หรือปรับปรุงยอด กรุณาใช้แบบฟอร์มปกติ
      </p>

      <ul className="batch-rows">
        {rows.map((row, i) => {
          const parsed = parsedRows[i]
          return (
            <li key={row.id} className="batch-row">
              <div className="batch-row__fields">
                <select
                  className="input input--compact"
                  value={row.expenseType}
                  onChange={(e) => updateRow(row.id, { expenseType: e.target.value as BatchType })}
                  aria-label="ประเภท"
                >
                  {(Object.keys(BATCH_TYPE_LABELS) as BatchType[]).map((t) => (
                    <option key={t} value={t}>
                      {BATCH_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={row.categoryId}
                  onChange={(e) => updateRow(row.id, { categoryId: e.target.value })}
                  aria-label="หมวดหมู่"
                >
                  {activeCategories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="input"
                list={`description-suggestions-${row.id}`}
                autoComplete="off"
                placeholder="รายละเอียด เช่น มอเตอร์ไซค์รับจ้าง"
                value={row.description}
                onChange={(e) => updateRow(row.id, { description: e.target.value })}
              />
              <datalist id={`description-suggestions-${row.id}`}>
                {(descriptionSuggestionsByCategory[row.categoryId] ?? []).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <input
                className="input"
                placeholder="จำนวนเงิน เช่น 15+15+15+15"
                value={row.amountsText}
                onChange={(e) => updateRow(row.id, { amountsText: e.target.value })}
              />
              <div className="batch-row__footer">
                <span className="batch-row__preview">
                  {parsed.amounts.length > 0
                    ? `${parsed.amounts.length} รายการ · รวม ${formatMoney(
                        parsed.amounts.reduce((a, b) => a + b, 0),
                        currency
                      )}`
                    : 'ยังไม่ได้ระบุจำนวนเงิน'}
                </span>
                {rows.length > 1 && (
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => removeRow(row.id)}>
                    ลบแถว
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Button type="button" variant="ghost" fullWidth onClick={addRow}>
        + เพิ่มแถว
      </Button>

      <section className="card batch-summary">
        <p>
          จะสร้าง <strong>{totalCount}</strong> รายการ รวม <strong>{formatMoney(totalAmount, currency)}</strong>
        </p>
        <Button type="button" fullWidth disabled={submitting || totalCount === 0} onClick={() => void handleSubmit()}>
          {submitting ? 'กำลังบันทึก...' : `บันทึกทั้งหมด (${totalCount})`}
        </Button>
      </section>
    </div>
  )
}
