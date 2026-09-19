import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/app/layout/BottomNav'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { UpdatePrompt } from '@/app/UpdatePrompt'
import { APP_CONFIG } from '@/shared/constants/config'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__title">{APP_CONFIG.appName}</span>
      </header>
      <OfflineBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <UpdatePrompt />
      <BottomNav />
    </div>
  )
}
