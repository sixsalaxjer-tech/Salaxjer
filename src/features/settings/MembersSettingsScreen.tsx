import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { addMember, deactivateMember, updateMember } from '@/domain/services/memberService'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Member } from '@/domain/entities/types'

const COLORS = ['#0f766e', '#ea580c', '#7c3aed', '#0284c7', '#db2777', '#65a30d']

export function MembersSettingsScreen() {
  const { household, members } = useHousehold()
  const toast = useToast()
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState<Member | null>(null)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!household) return
    setError(undefined)
    try {
      await addMember(household.householdId, { displayName, role: 'member', color })
      setDisplayName('')
      toast.show('success', 'เพิ่มสมาชิกแล้ว')
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  async function handleRename(member: Member, newName: string) {
    try {
      await updateMember(member.memberId, { displayName: newName })
      setEditing(null)
      toast.show('success', 'แก้ไขชื่อสมาชิกแล้ว')
    } catch (err) {
      toast.show('error', err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  async function handleDeactivate(memberId: string) {
    await deactivateMember(memberId)
    toast.show('success', 'ปิดใช้งานสมาชิกแล้ว')
  }

  return (
    <div className="screen">
      <form className="form" onSubmit={handleAdd}>
        <Field label="เพิ่มสมาชิกใหม่" htmlFor="new-member-name" error={error}>
          <input
            id="new-member-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ชื่อที่แสดง"
            required
          />
        </Field>
        <div className="color-picker">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`เลือกสี ${c}`}
              className={`color-picker__swatch${color === c ? ' color-picker__swatch--active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <Button type="submit" fullWidth>
          เพิ่มสมาชิก
        </Button>
      </form>

      {members.length === 0 ? (
        <EmptyState icon="👪" title="ยังไม่มีสมาชิก" />
      ) : (
        <ul className="settings-list">
          {members.map((m) => (
            <li key={m.memberId} className="member-row">
              <span className="color-dot" style={{ backgroundColor: m.color }} />
              {editing?.memberId === m.memberId ? (
                <input
                  className="input input--compact"
                  defaultValue={m.displayName}
                  autoFocus
                  onBlur={(e) => void handleRename(m, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
              ) : (
                <span className="member-row__name">{m.displayName}</span>
              )}
              <span className={`badge badge--status-${m.status === 'active' ? 'active' : 'voided'}`}>
                {m.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </span>
              {m.status === 'active' && (
                <div className="member-row__actions">
                  <button className="btn btn--ghost btn--small" onClick={() => setEditing(m)}>
                    แก้ไข
                  </button>
                  <button className="btn btn--ghost btn--small" onClick={() => void handleDeactivate(m.memberId)}>
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
