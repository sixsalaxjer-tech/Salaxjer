import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { addCategory, deactivateCategory } from '@/domain/services/categoryService'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export function CategoriesSettingsScreen() {
  const { household, categories } = useHousehold()
  const toast = useToast()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📦')
  const [error, setError] = useState<string>()

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!household) return
    setError(undefined)
    try {
      await addCategory(household.householdId, { name, icon, color: '#64748b' })
      setName('')
      toast.show('success', 'เพิ่มหมวดหมู่แล้ว')
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  async function handleDeactivate(categoryId: string) {
    await deactivateCategory(categoryId)
    toast.show('success', 'ปิดใช้งานหมวดหมู่แล้ว')
  }

  return (
    <div className="screen">
      <form className="form" onSubmit={handleAdd}>
        <Field label="เพิ่มหมวดหมู่ใหม่" htmlFor="new-category-name" error={error}>
          <div className="inline-fields">
            <input
              id="new-category-icon"
              className="input input--icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={2}
              aria-label="ไอคอน"
            />
            <input
              id="new-category-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อหมวดหมู่"
              required
            />
          </div>
        </Field>
        <Button type="submit" fullWidth>
          เพิ่มหมวดหมู่
        </Button>
      </form>

      {categories.length === 0 ? (
        <EmptyState icon="🏷️" title="ยังไม่มีหมวดหมู่" />
      ) : (
        <ul className="settings-list">
          {categories.map((c) => (
            <li key={c.categoryId} className="member-row">
              <span aria-hidden="true">{c.icon}</span>
              <span className="member-row__name">{c.name}</span>
              <span className={`badge badge--status-${c.status === 'active' ? 'active' : 'voided'}`}>
                {c.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </span>
              {c.status === 'active' && (
                <div className="member-row__actions">
                  <button className="btn btn--ghost btn--small" onClick={() => void handleDeactivate(c.categoryId)}>
                    ปิดใช้งาน
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
