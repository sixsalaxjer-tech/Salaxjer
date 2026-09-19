import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/app/layout/BottomNav'
import { APP_CONFIG } from '@/shared/constants/config'

// OfflineBanner and UpdatePrompt are mounted once at the App root (not here), so the offline
// indicator and service-worker registration are active from the very first paint — including
// the onboarding screen, before any household exists. See src/App.tsx.
export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__title">{APP_CONFIG.appName}</span>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
