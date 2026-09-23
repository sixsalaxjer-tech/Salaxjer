import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { createExpense, listDescriptionSuggestionsByCategory, updateExpense } from '@/domain/services/expenseService'
import { findDuplicateCandidates } from '@/domain/rules/duplicate'
import { AllocationEditor, type AllocationRowState } from '@/features/expenses/AllocationEditor'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AppError } from '@/shared/types/errors'
import { todayIso } from '@/shared/formatting/date'
import type { AllocationType, Expense, ExpenseType } from '@/domain/entities/types'

const TYPE_LABELS: Record<ExpenseType, string> = {
  personal: 'ส่วนตัว',
  shared: 'ร่วมกัน',
  advance: 'สำรองจ่าย',
  household: 'ส่วนกลาง',
  income: 'รายได้',
  adjustment: 'ปรับปรุงยอด'
}

const NEEDS_ALLOCATION: ExpenseType[] = ['shared', 'advance', 'household']

export function ExpenseForm({ existing }: { existing?: Expense }) {
  const { household, activeMembers, activeCategories } = useHousehold()
  const navigate = useNavigate()
  const toast = useToast()

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [expenseDate, setExpenseDate] = useState(existing?.expenseDate ?? todayIso())
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? activeCategories[0]?.categoryId ?? '')
  const [paidByMemberId, setPaidByMemberId] = useState(existing?.paidByMemberId ?? activeMembers[0]?.memberId ?? '')
  const [expenseType, setExpenseType] = useState<ExpenseType>(existing?.expenseType ?? 'personal')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [tagsText, setTagsText] = useState(existing?.tags.join(', ') ?? '')
  const [adjustmentReason, setAdjustmentReason] = useState(existing?.adjustmentReason ?? '')
  const [allocationType, setAllocationType] = useState<AllocationType>('equal')
  const [rows, setRows] = useState<AllocationRowState[]>(
    activeMembers.map((m) => ({ memberId: m.memberId, selected: true, exactAmount: '', percentage: '' }))
  )
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState<Expense[] | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidv4())
  const [descriptionSuggestionsByCategory, setDescriptionSuggestionsByCategory] = useState<Record<string, string[]>>(
    {}
  )

  useEffect(() => {
    if (!household) return
    listDescriptionSuggestionsByCategory(household.householdId).then(setDescriptionSuggestionsByCategory)
  }, [household?.householdId])

  const descriptionSuggestions = descriptionSuggestionsByCategory[categoryId] ?? []

  const needsAllocation = NEEDS_ALLOCATION.includes(expenseType)
  const tags = useMemo(
    () => tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsText]
  )

  async function persist(status: 'draft' | 'active') {
    if (!household) return
    setSubmitting(true)
    setError(undefined)
    try {
      const allocationEntries = rows
        .filter((r) => r.selected)
        .map((r) => ({
          memberId: r.memberId,
          exactAmount: Number(r.exactAmount || 0),
          percentage: Number(r.percentage || 0)
        }))

      const payload = {
        householdId: household.householdId,
        expenseDate,
        amount: Number(amount),
        currency: household.baseCurrency,
        categoryId,
        paidByMemberId,
        expenseType,
        description,
        tags,
        status,
        allocationType,
        allocationEntries,
        adjustmentReason: expenseType === 'adjustment' ? adjustmentReason : undefined
      }

      if (existing) {
        await updateExpense({ ...payload, expenseId: existing.expenseId })
        toast.show('success', 'บันทึกการแก้ไขเรียบร้อยแล้ว')
      } else {
        await createExpense({ ...payload, idempotencyKey })
        toast.show('success', status === 'draft' ? 'บันทึกแบบร่างแล้ว' : 'บันทึกรายการเรียบร้อยแล้ว')
        setIdempotencyKey(uuidv4())
      }
      navigate('/transactions')
    } catch (err) {
      const message = err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ'
      setError(message)
      toast.show('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSave(status: 'draft' | 'active') {
    if (!household) return
    if (status === 'active' && !existing) {
      const candidates = await findDuplicateCandidates({
        householdId: household.householdId,
        expenseDate,
        amount: Number(amount),
        paidByMemberId,
        categoryId,
        description
      })
      if (candidates.length > 0) {
        setDuplicateCandidates(candidates)
        return
      }
    }
    await persist(status)
  }

  return (
    <div className="screen expense-form">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave('active')
        }}
      >
        <Field label="จำนวนเงิน" htmlFor="amount" error={error}>
          <input
            id="amount"
            className="input input--amount"
            type="number"
            inputMode="decimal"
            min={expenseType === 'adjustment' ? undefined : 0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="วันที่" htmlFor="expense-date">
          <input
            id="expense-date"
            className="input"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </Field>

        <Field label="หมวดหมู่" htmlFor="category">
          <select id="category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {activeCategories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ผู้จ่าย" htmlFor="paid-by">
          <select id="paid-by" className="input" value={paidByMemberId} onChange={(e) => setPaidByMemberId(e.target.value)} required>
            {activeMembers.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ประเภทค่าใช้จ่าย" htmlFor="expense-type">
          <div className="segmented" role="radiogroup">
            {(Object.keys(TYPE_LABELS) as ExpenseType[]).map((type) => (
              <button
                type="button"
                key={type}
                role="radio"
                aria-checked={expenseType === type}
                className={`segmented__option${expenseType === type ? ' segmented__option--active' : ''}`}
                onClick={() => setExpenseType(type)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </Field>

        {expenseType === 'adjustment' && (
          <Field label="เหตุผลการปรับปรุงยอด" htmlFor="adjustment-reason">
            <input
              id="adjustment-reason"
              className="input"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              required
            />
          </Field>
        )}

        {needsAllocation && (
          <Field label="ผู้รับผิดชอบและวิธีแบ่ง" htmlFor="allocation">
            <AllocationEditor
              members={activeMembers}
              currency={household?.baseCurrency ?? 'THB'}
              totalAmount={Number(amount || 0)}
              allocationType={allocationType}
              rows={rows}
              onAllocationTypeChange={setAllocationType}
              onRowsChange={setRows}
            />
          </Field>
        )}

        <Field label="รายละเอียด" htmlFor="description">
          <input
            id="description"
            className="input"
            list="description-suggestions"
            autoComplete="off"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <datalist id="description-suggestions">
            {descriptionSuggestions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        <Field label="Tags" htmlFor="tags" hint="คั่นด้วยจุลภาค (,)">
          <input id="tags" className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </Field>

        <div className="form__actions">
          <Button type="button" variant="secondary" fullWidth onClick={() => void handleSave('draft')} disabled={submitting}>
            บันทึกแบบร่าง
          </Button>
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>

      {duplicateCandidates && (
        <ConfirmDialog
          title="พบรายการที่อาจซ้ำกัน"
          description="มีรายการที่มีวันที่ จำนวนเงิน ผู้จ่าย และหมวดหมู่เดียวกันอยู่แล้ว ต้องการทำอย่างไร?"
          onDismiss={() => setDuplicateCandidates(null)}
          actions={[
            {
              label: 'บันทึกต่อ',
              variant: 'primary',
              onSelect: () => {
                setDuplicateCandidates(null)
                void persist('active')
              }
            },
            {
              label: 'ไปที่รายการเดิม',
              variant: 'secondary',
              onSelect: () => {
                setDuplicateCandidates(null)
                navigate('/transactions')
              }
            },
            { label: 'ยกเลิก', variant: 'ghost', onSelect: () => setDuplicateCandidates(null) }
          ]}
        />
      )}
    </div>
  )
}
