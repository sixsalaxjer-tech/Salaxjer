import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function SettingsSubScreen({
  title,
  children,
  backTo = '/settings'
}: {
  title: string
  children: ReactNode
  backTo?: string
}) {
  return (
    <div>
      <div className="sub-header">
        <Link to={backTo} className="sub-header__back" aria-label="ย้อนกลับ">
          ‹
        </Link>
        <h2 className="sub-header__title">{title}</h2>
      </div>
      {children}
    </div>
  )
}
