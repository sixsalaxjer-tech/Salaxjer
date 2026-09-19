import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'

/**
 * PWA update strategy (spec risk "Offline Cache เก่า"): registerType 'prompt' means a new
 * service worker waits until the user explicitly asks to reload, so an in-progress offline
 * entry is never interrupted by a silent update.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    }
  })

  if (offlineReady) {
    return (
      <div className="update-toast" role="status">
        <span>พร้อมใช้งานออฟไลน์แล้ว</span>
        <Button variant="ghost" onClick={() => setOfflineReady(false)}>
          ปิด
        </Button>
      </div>
    )
  }

  if (needRefresh) {
    return (
      <div className="update-toast" role="status">
        <span>มีเวอร์ชันใหม่ของแอป</span>
        <Button variant="primary" onClick={() => updateServiceWorker(true)}>
          อัปเดตตอนนี้
        </Button>
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          ภายหลัง
        </Button>
      </div>
    )
  }

  return null
}
