import { useState, type FormEvent } from 'react'
import { createCloudHousehold } from '@/domain/services/cloudHouseholdService'
import { useAuth } from '@/app/providers/AuthProvider'
import { SUPPORTED_CURRENCIES } from '@/shared/constants/currency'
import { APP_CONFIG } from '@/shared/constants/config'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

/**
 * Shown after login when the (single, shared) account isn't linked to a household yet — a
 * one-time step the first time anyone logs in. There is no "join with invite code" flow: by
 * design there is exactly one shared username/password for the whole household (see
 * docs/CLOUD_SYNC.md) — whoever authenticates with it is the same household, always.
 */
export function HouseholdSetupScreen() {
  const { signOut } = useAuth()
  const [householdName, setHouseholdName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState(APP_CONFIG.defaultCurrency)
  const [monthStartDay, setMonthStartDay] = useState(1)
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await createCloudHousehold({ name: householdName, baseCurrency, monthStartDay })
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__title">ตั้งค่าครอบครัว</h1>
      <p className="onboarding__subtitle">ขั้นตอนเดียว ทำครั้งแรกที่เข้าสู่ระบบเท่านั้น</p>

      <form className="form" onSubmit={handleSubmit}>
        <Field label="ชื่อครอบครัว" htmlFor="setup-household-name" error={error}>
          <input
            id="setup-household-name"
            className="input"
            required
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="เช่น บ้านสุขใจ"
          />
        </Field>
        <Field label="สกุลเงินหลัก" htmlFor="setup-currency">
          <select
            id="setup-currency"
            className="input"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันเริ่มต้นรอบเดือน" htmlFor="setup-month-start" hint="ค่าเริ่มต้นคือวันที่ 1 ของทุกเดือน">
          <input
            id="setup-month-start"
            type="number"
            min={1}
            max={28}
            className="input"
            value={monthStartDay}
            onChange={(e) => setMonthStartDay(Number(e.target.value))}
          />
        </Field>

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'สร้างครอบครัว'}
        </Button>
      </form>

      <p className="auth-switch">
        เข้าบัญชีผิด?{' '}
        <button type="button" className="auth-switch__link" onClick={() => void signOut()}>
          ออกจากระบบ
        </button>
      </p>
    </div>
  )
}
