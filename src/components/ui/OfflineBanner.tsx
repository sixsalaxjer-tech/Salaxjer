import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { APP_CONFIG } from '@/shared/constants/config'

/** FR/NFR-001 + NFR-010: a persistent, unmissable offline indicator. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      ออฟไลน์ — ข้อมูลจะถูกเก็บไว้ในอุปกรณ์นี้{APP_CONFIG.syncEnabled ? 'และซิงก์เมื่อออนไลน์' : ''}
    </div>
  )
}
