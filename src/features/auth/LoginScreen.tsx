import { useState, type FormEvent } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { translateAuthError } from '@/features/auth/authErrors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { APP_CONFIG } from '@/shared/constants/config'

/** No sign-up screen exists — there is exactly one shared username/password for the whole
 * household (see docs/CLOUD_SYNC.md), created once via the Supabase Dashboard. */
export function LoginScreen() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await signIn(username, password)
    } catch (err) {
      setError(translateAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__title">{APP_CONFIG.appName}</h1>
      <p className="onboarding__subtitle">เข้าสู่ระบบเพื่อดูข้อมูลค่าใช้จ่ายของครอบครัวแบบเรียลไทม์</p>
      <form className="form" onSubmit={handleSubmit}>
        <Field label="ชื่อผู้ใช้" htmlFor="login-username" error={error}>
          <input
            id="login-username"
            type="text"
            className="input"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </Field>
        <Field label="รหัสผ่าน" htmlFor="login-password">
          <input
            id="login-password"
            type="password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  )
}
