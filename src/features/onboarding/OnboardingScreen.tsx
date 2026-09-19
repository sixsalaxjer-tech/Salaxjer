import { useState, type FormEvent } from 'react'
import { createHousehold } from '@/domain/services/householdService'
import { SUPPORTED_CURRENCIES } from '@/shared/constants/currency'
import { APP_CONFIG } from '@/shared/constants/config'
import { AppError } from '@/shared/types/errors'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

/** FR-001: at least one Household must exist before any expense can be recorded. */
export function OnboardingScreen() {
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState(APP_CONFIG.defaultCurrency)
  const [monthStartDay, setMonthStartDay] = useState(1)
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await createHousehold({ name, baseCurrency, monthStartDay })
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__title">ยินดีต้อนรับ 👋</h1>
      <p className="onboarding__subtitle">เริ่มต้นด้วยการตั้งค่าครอบครัวของคุณ ใช้งานได้ทันทีแม้ไม่มีอินเทอร์เน็ต</p>
      <form onSubmit={handleSubmit} className="form">
        <Field label="ชื่อครอบครัว" htmlFor="household-name" error={error}>
          <input
            id="household-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น บ้านสุขใจ"
            required
          />
        </Field>
        <Field label="สกุลเงินหลัก" htmlFor="household-currency">
          <select
            id="household-currency"
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
        <Field label="วันเริ่มต้นรอบเดือน" htmlFor="household-month-start" hint="ค่าเริ่มต้นคือวันที่ 1 ของทุกเดือน">
          <input
            id="household-month-start"
            type="number"
            min={1}
            max={28}
            className="input"
            value={monthStartDay}
            onChange={(e) => setMonthStartDay(Number(e.target.value))}
          />
        </Field>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'เริ่มใช้งาน'}
        </Button>
      </form>
    </div>
  )
}
