/** Supabase Auth returns English error messages; map the common ones to Thai for this UI.
 * Login here is username + password (see syntheticEmail.ts) — Supabase's messages still refer
 * to "email" internally, so they're reworded to "ชื่อผู้ใช้" for the user. */
export function translateAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(message)) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
  if (/user already registered/i.test(message)) return 'ชื่อผู้ใช้นี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบแทน'
  if (/password.*at least/i.test(message)) return 'รหัสผ่านสั้นเกินไป กรุณาใช้อย่างน้อย 6 ตัวอักษร'
  if (/email.*invalid/i.test(message)) return 'ชื่อผู้ใช้ไม่ถูกต้อง กรุณาใช้ตัวอักษรหรือตัวเลขอย่างน้อย 3 ตัว'
  if (/email not confirmed/i.test(message)) return 'บัญชีนี้ยังไม่ได้ยืนยัน กรุณาติดต่อผู้ดูแลระบบ'
  if (/rate limit/i.test(message)) return 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
}
