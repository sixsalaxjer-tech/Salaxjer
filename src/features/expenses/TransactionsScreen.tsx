import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { listExpenses, voidExpense, duplicateExpense, type ExpenseFilters } from '@/domain/services/expenseService'
import { formatDateThai } from '@/shared/formatting/date'
import { formatMoney } from '@/shared/formatting/money'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ExpenseStatusBadge, SyncStatusBadge } from '@/components/ui/StatusBadge'
import type { Expense, ExpenseType } from '@/domain/entities/types'

export function TransactionsScreen() {
  const { household, members, categories, loading: householdLoading } = useHousehold()
  const toast = useToast()

  const [searchText, setSearchText] = useState('')
  const [memberId, setMemberId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType | ''>('')
  const [items, setItems] = useState<Expense[]>()
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null)

  const filters: ExpenseFilters | null = household
    ? {
        householdId: household.householdId,
        searchText,
        memberId: memberId || undefined,
        categoryId: categoryId || undefined,
        expenseType: expenseType || undefined
      }
    : null

  async function reload() {
    if (!filters) return
    setItems(await listExpenses(filters))
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.householdId, searchText, memberId, categoryId, expenseType])

  const grouped = useMemo(() => {
    if (!items) return []
    const map = new Map<string, Expense[]>()
    for (const e of items) {
      const list = map.get(e.expenseDate) ?? []
      list.push(e)
      map.set(e.expenseDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [items])

  function clearFilters() {
    setSearchText('')
    setMemberId('')
    setCategoryId('')
    setExpenseType('')
  }

  async function handleDuplicate(expenseId: string) {
    try {
      await duplicateExpense(expenseId)
      toast.show('success', 'สร้างสำเนารายการเป็นแบบร่างแล้ว')
      await reload()
    } catch {
      toast.show('error', 'ทำรายการไม่สำเร็จ')
    }
  }

  async function handleVoid() {
    if (!voidTarget) return
    try {
      await voidExpense(voidTarget.expenseId)
      toast.show('success', 'ยกเลิกรายการแล้ว')
      setVoidTarget(null)
      await reload()
    } catch {
      toast.show('error', 'ทำรายการไม่สำเร็จ')
    }
  }

  if (householdLoading || !items) return <LoadingState />

  return (
    <div className="screen transactions">
      <div className="filters">
        <input
          className="input"
          placeholder="ค้นหารายละเอียดหรือ Tags"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="filters__row">
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">ทุกคน</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName}
              </option>
            ))}
          </select>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost" onClick={clearFilters}>
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon="🔍" title="ไม่พบรายการ" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
      ) : (
        grouped.map(([date, expenses]) => (
          <section key={date} className="tx-group">
            <h3 className="tx-group__date">{formatDateThai(date)}</h3>
            <ul className="tx-list">
              {expenses.map((e) => {
                const payer = members.find((m) => m.memberId === e.paidByMemberId)
                const category = categories.find((c) => c.categoryId === e.categoryId)
                return (
                  <li key={e.expenseId} className="tx-item">
                    <div className="tx-item__main">
                      <span className="tx-item__category">{category?.icon ?? '📦'}</span>
                      <div className="tx-item__info">
                        <span className="tx-item__desc">{e.description || category?.name || 'ไม่มีรายละเอียด'}</span>
                        <span className="tx-item__meta">
                          {payer?.displayName ?? 'ไม่ระบุ'} · {category?.name ?? 'ไม่ระบุหมวดหมู่'}
                        </span>
                      </div>
                      <div className="tx-item__amount-col">
                        <span className="tx-item__amount">{formatMoney(e.amount, e.currency)}</span>
                        <div className="tx-item__badges">
                          <ExpenseStatusBadge status={e.status} />
                          <SyncStatusBadge status={e.syncStatus} />
                        </div>
                      </div>
                    </div>
                    {e.status !== 'voided' && (
                      <div className="tx-item__actions">
                        <Link to={`/transactions/${e.expenseId}/edit`} className="btn btn--ghost btn--small">
                          แก้ไข
                        </Link>
                        <button className="btn btn--ghost btn--small" onClick={() => void handleDuplicate(e.expenseId)}>
                          ทำสำเนา
                        </button>
                        <button className="btn btn--ghost btn--small" onClick={() => setVoidTarget(e)}>
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {voidTarget && (
        <ConfirmDialog
          title="ยืนยันการยกเลิกรายการ"
          description={`ยกเลิกรายการ "${voidTarget.description || 'ไม่มีรายละเอียด'}" จำนวน ${formatMoney(voidTarget.amount, voidTarget.currency)} ?`}
          onDismiss={() => setVoidTarget(null)}
          actions={[
            { label: 'ยกเลิกรายการ', variant: 'danger', onSelect: () => void handleVoid() },
            { label: 'ปิด', variant: 'ghost', onSelect: () => setVoidTarget(null) }
          ]}
        />
      )}
    </div>
  )
}
