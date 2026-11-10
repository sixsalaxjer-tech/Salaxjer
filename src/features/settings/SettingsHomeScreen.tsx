import { Link } from 'react-router-dom'
import { APP_CONFIG } from '@/shared/constants/config'

const ITEMS = [
  { to: '/settings/household', icon: '🏠', label: 'ครอบครัว' },
  { to: '/settings/members', icon: '👪', label: 'สมาชิก' },
  { to: '/settings/categories', icon: '🏷️', label: 'หมวดหมู่' },
  { to: '/settings/backup', icon: '💾', label: 'สำรองและกู้คืนข้อมูล' },
  { to: '/settings/storage', icon: '📦', label: 'พื้นที่จัดเก็บ' }
]

export function SettingsHomeScreen() {
  return (
    <div className="screen settings-home">
      <ul className="settings-list">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="settings-list__item">
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              <span className="settings-list__chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="about-footer">
        {APP_CONFIG.appName} · เวอร์ชัน 0.1.0 (Phase 1 Local Offline MVP)
      </p>
    </div>
  )
}
