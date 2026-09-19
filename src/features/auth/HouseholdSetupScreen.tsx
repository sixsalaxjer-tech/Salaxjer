import { useState, type FormEvent } from 'react'
import { createCloudHousehold, joinCloudHousehold } from '@/domain/services/cloudHouseholdService'
import { useAuth } from '@/app/providers/AuthProvider'
import { SUPPORTED_CURRENCIES } from '@/shared/constants/currency'
import { APP_CONFIG } from '@/shared/constants/config'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

type SetupMode = 'create' | 'join'

/**
 * Shown after login when the account isn't linked to a household yet — either the very first
 * login ever (create), or a second admin-created account joining the existing household by
 * invite code (see docs/CLOUD_SYNC.md — accounts are still only ever created via the Supabase
 * Dashboard, never through the app; this screen only handles linking one to a household).
 */
export function HouseholdSetupScreen() {
  const { signOut } = useAuth()
  const [mode, setMode] = useState<SetupMode>('create')
  const [householdName, setHouseholdName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState(APP_CONFIG.defaultCurrency)
  const [monthStartDay, setMonthStartDay] = useState(1)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await createCloudHousehold({ name: householdName, baseCurrency, monthStartDay })
      } else {
        await joinCloudHousehold(inviteCode)
      }
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__title">ตั้งค่าครอบครัว</h1>
      <p className="onboarding__subtitle">บัญชีนี้ยังไม่ได้เชื่อมโยงกับครอบครัวใด สร้างใหม่ หรือเข้าร่วมด้วยรหัสเชิญ</p>

      <div className="tab-group" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`tab-group__tab${mode === 'create' ? ' tab-group__tab--active' : ''}`}
          onClick={() => setMode('create')}
        >
          สร้างครอบครัวใหม่
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          className={`tab-group__tab${mode === 'join' ? ' tab-group__tab--active' : ''}`}
          onClick={() => setMode('join')}
        >
          เข้าร่วมด้วยรหัสเชิญ
        </button>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {mode === 'create' ? (
          <>
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
          </>
        ) : (
          <Field
            label="รหัสเชิญ"
            htmlFor="setup-invite-code"
            error={error}
            hint="ดูรหัสเชิญได้ที่ ตั้งค่า > ครอบครัว จากอีกบัญชีที่สร้างครอบครัวไว้แล้ว"
          >
            <input
              id="setup-invite-code"
              className="input"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="เช่น A1B2C3"
            />
          </Field>
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : mode === 'create' ? 'สร้างครอบครัว' : 'เข้าร่วม'}
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
