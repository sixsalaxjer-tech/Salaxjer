import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'สรุป', icon: '📊', end: true },
  { to: '/transactions', label: 'รายการ', icon: '📋', end: false },
  { to: '/add', label: 'เพิ่ม', icon: '➕', end: false },
  { to: '/settlement', label: 'เคลียร์ยอด', icon: '🤝', end: false },
  { to: '/settings', label: 'ตั้งค่า', icon: '⚙️', end: false }
]

/** Bottom navigation per spec section 15.1. */
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="เมนูหลัก">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          <span aria-hidden="true" className="bottom-nav__icon">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
