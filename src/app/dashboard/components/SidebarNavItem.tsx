'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  exact?: boolean
}

export default function SidebarNavItem({ href, icon: Icon, label, badge, exact }: Props) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
      style={{
        backgroundColor: isActive ? 'rgba(61,212,230,0.1)' : 'transparent',
        color: isActive ? '#0BB5C7' : 'var(--color-text-secondary)',
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{ backgroundColor: '#0BB5C7', color: '#fff' }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
