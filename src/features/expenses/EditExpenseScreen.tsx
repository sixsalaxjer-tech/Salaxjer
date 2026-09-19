import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/infrastructure/db/db'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

export function EditExpenseScreen() {
  const { expenseId } = useParams<{ expenseId: string }>()
  const expense = useLiveQuery(() => (expenseId ? db.expenses.get(expenseId) : undefined), [expenseId])

  if (expense === undefined) return <LoadingState />
  if (!expense) return <EmptyState icon="🔍" title="ไม่พบรายการ" />
  if (expense.status === 'voided') {
    return <EmptyState icon="🚫" title="รายการนี้ถูกยกเลิกแล้ว" description="ไม่สามารถแก้ไขรายการที่ถูกยกเลิก" />
  }

  return <ExpenseForm existing={expense} />
}
