import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'

const UPDATE_CHECK_INTERVAL_MS = 60_000

/**
 * PWA update strategy (spec risk "Offline Cache เก่า"): registerType 'prompt' means a new
 * service worker waits until the user explicitly asks to reload, so an in-progress offline
 * entry is never interrupted by a silent update.
 *
 * GitHub Pages serves sw.js with `Cache-Control: max-age=600` and cannot be configured
 * otherwise, so a plain `registration.update()` can legitimately keep finding the browser's
 * still-fresh cached copy of the OLD script for up to 10 minutes after a deploy — the update
 * check itself isn't broken, it's just honoring HTTP caching on a host that caches too
 * aggressively for a service worker script. Forcing a `cache: 'reload'` fetch of the script
 * first (bypassing HTTP cache) before every update check works around this reliably.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
    onRegisteredSW(_swScriptUrl, registration) {
      registrationRef.current = registration
    }
  })

  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)

  useEffect(() => {
    async function checkForUpdate() {
      const registration = registrationRef.current
      if (!registration?.active) return
      try {
        await fetch(registration.active.scriptURL, { cache: 'reload' })
        await registration.update()
      } catch {
        // Best-effort freshness check — offline or a network hiccup just means try again later.
      }
    }

    void checkForUpdate()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [])

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
