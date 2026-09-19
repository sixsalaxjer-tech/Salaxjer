import { useMemo } from 'react'
import type { AllocationType } from '@/domain/entities/types'
import type { Member } from '@/domain/entities/types'
import {
  computeEqualAllocation,
  computeExactAllocation,
  computePercentageAllocation
} from '@/domain/rules/allocation'
import { AppError } from '@/shared/types/errors'
import { formatMoney } from '@/shared/formatting/money'

export interface AllocationRowState {
  memberId: string
  selected: boolean
  exactAmount: string
  percentage: string
}

interface AllocationEditorProps {
  members: Member[]
  currency: string
  totalAmount: number
  allocationType: AllocationType
  rows: AllocationRowState[]
  onAllocationTypeChange: (type: AllocationType) => void
  onRowsChange: (rows: AllocationRowState[]) => void
}

const TYPE_LABELS: Record<AllocationType, string> = {
  equal: 'แบ่งเท่ากัน',
  exact: 'ระบุจำนวนเงิน',
  percentage: 'ระบุเปอร์เซ็นต์'
}

/** FR-004: Equal / Exact / Percentage allocation editor with a live balance preview. */
export function AllocationEditor({
  members,
  currency,
  totalAmount,
  allocationType,
  rows,
  onAllocationTypeChange,
  onRowsChange
}: AllocationEditorProps) {
  function toggleMember(memberId: string) {
    onRowsChange(
      rows.map((r) => (r.memberId === memberId ? { ...r, selected: !r.selected } : r))
    )
  }

  function updateRow(memberId: string, patch: Partial<AllocationRowState>) {
    onRowsChange(rows.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)))
  }

  const preview = useMemo(() => {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0 || totalAmount <= 0) return { error: undefined, diff: 0 }
    try {
      if (allocationType === 'equal') {
        computeEqualAllocation(totalAmount, currency, selected.map((r) => r.memberId))
      } else if (allocationType === 'exact') {
        computeExactAllocation(
          totalAmount,
          currency,
          selected.map((r) => ({ memberId: r.memberId, exactAmount: Number(r.exactAmount || 0) }))
        )
      } else {
        computePercentageAllocation(
          totalAmount,
          currency,
          selected.map((r) => ({ memberId: r.memberId, percentage: Number(r.percentage || 0) }))
        )
      }
      return { error: undefined, diff: 0 }
    } catch (err) {
      return { error: err instanceof AppError ? err.userMessage : 'ยอดแบ่งค่าใช้จ่ายไม่เท่ากับยอดรวม', diff: 0 }
    }
  }, [rows, allocationType, totalAmount, currency])

  return (
    <div className="allocation-editor">
      <div className="tab-group" role="tablist">
        {(Object.keys(TYPE_LABELS) as AllocationType[]).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={allocationType === type}
            className={`tab-group__tab${allocationType === type ? ' tab-group__tab--active' : ''}`}
            onClick={() => onAllocationTypeChange(type)}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <ul className="allocation-editor__list">
        {members.map((m) => {
          const row = rows.find((r) => r.memberId === m.memberId)
          if (!row) return null
          return (
            <li key={m.memberId} className="allocation-editor__row">
              <label className="allocation-editor__member">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleMember(m.memberId)}
                />
                <span className="color-dot" style={{ backgroundColor: m.color }} />
                {m.displayName}
              </label>
              {row.selected && allocationType === 'exact' && (
                <input
                  type="number"
                  inputMode="decimal"
                  className="input input--compact"
                  placeholder={formatMoney(0, currency)}
                  value={row.exactAmount}
                  onChange={(e) => updateRow(m.memberId, { exactAmount: e.target.value })}
                />
              )}
              {row.selected && allocationType === 'percentage' && (
                <input
                  type="number"
                  inputMode="decimal"
                  className="input input--compact"
                  placeholder="%"
                  value={row.percentage}
                  onChange={(e) => updateRow(m.memberId, { percentage: e.target.value })}
                />
              )}
            </li>
          )
        })}
      </ul>

      {preview.error && (
        <p className="field__error" role="alert">
          {preview.error}
        </p>
      )}
    </div>
  )
}
