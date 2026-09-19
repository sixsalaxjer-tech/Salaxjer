import { Link } from 'react-router-dom'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export function AddExpenseScreen() {
  const { activeMembers, activeCategories, loading } = useHousehold()

  if (loading) return null

  if (activeMembers.length === 0) {
    return (
      <EmptyState
        icon="👪"
        title="ยังไม่มีสมาชิก"
        description="กรุณาเพิ่มสมาชิกอย่างน้อยหนึ่งคนก่อนบันทึกค่าใช้จ่าย"
        action={
          <Link to="/settings/members">
            <Button>ไปที่หน้าจัดการสมาชิก</Button>
          </Link>
        }
      />
    )
  }

  if (activeCategories.length === 0) {
    return (
      <EmptyState
        icon="🏷️"
        title="ยังไม่มีหมวดหมู่"
        description="กรุณาเพิ่มหมวดหมู่อย่างน้อยหนึ่งรายการก่อนบันทึกค่าใช้จ่าย"
        action={
          <Link to="/settings/categories">
            <Button>ไปที่หน้าจัดการหมวดหมู่</Button>
          </Link>
        }
      />
    )
  }

  return <ExpenseForm />
}
