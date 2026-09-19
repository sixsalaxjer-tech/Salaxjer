import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useAuth } from '@/app/providers/AuthProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { updateHousehold } from '@/domain/services/householdService'
import { SUPPORTED_CURRENCIES } from '@/shared/constants/currency'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'

export function HouseholdSettingsScreen() {
  const { household, loading } = useHousehold()
  const { enabled: authEnabled, user, signOut } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(household?.name ?? '')
  const [baseCurrency, setBaseCurrency] = useState(household?.baseCurrency ?? 'THB')
  const [monthStartDay, setMonthStartDay] = useState(household?.monthStartDay ?? 1)
  const [error, setError] = useState<string>()

  if (loading) return <LoadingState />
  if (!household) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      await updateHousehold(household!.householdId, { name, baseCurrency, monthStartDay })
      toast.show('success', 'บันทึกการตั้งค่าครอบครัวแล้ว')
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div className="screen">
      <form className="form" onSubmit={handleSubmit}>
        <Field label="ชื่อครอบครัว" htmlFor="hh-name" error={error}>
          <input id="hh-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="สกุลเงินหลัก" htmlFor="hh-currency">
          <select id="hh-currency" className="input" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันเริ่มต้นรอบเดือน" htmlFor="hh-month-start">
          <input
            id="hh-month-start"
            type="number"
            min={1}
            max={28}
            className="input"
            value={monthStartDay}
            onChange={(e) => setMonthStartDay(Number(e.target.value))}
          />
        </Field>
        <Button type="submit" fullWidth>
          บันทึก
        </Button>
      </form>

      {authEnabled && (
        <section className="card">
          <h2 className="card__title">บัญชีออนไลน์</h2>
          {user?.email && <p className="field__hint">เข้าสู่ระบบด้วยชื่อผู้ใช้ "{user.email.split('@')[0]}"</p>}
          {household.inviteCode && (
            <>
              <p className="field__hint">
                ให้ผู้ดูแลสร้างบัญชีใหม่ใน Supabase Dashboard ก่อน แล้วใช้รหัสนี้ตอนเข้าสู่ระบบครั้งแรก
                (เลือก "เข้าร่วมด้วยรหัสเชิญ") เพื่อเห็นข้อมูลเดียวกันแบบเรียลไทม์
              </p>
              <p className="invite-code">{household.inviteCode}</p>
            </>
          )}
          <Button variant="secondary" fullWidth onClick={() => void signOut()}>
            ออกจากระบบ
          </Button>
        </section>
      )}
    </div>
  )
}
