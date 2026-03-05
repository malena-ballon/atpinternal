'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  GraduationCap,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  Settings,
} from 'lucide-react'

interface NavItemProps {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  exact?: boolean
}

function NavItem({ href, icon: Icon, label, badge, exact }: NavItemProps) {
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

interface Props {
  name: string
  role: string
  pendingApprovals: number
}

export default function Sidebar({ name, role, pendingApprovals }: Props) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside
      className="flex flex-col"
      style={{
        width: '240px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(61,212,230,0.12)' }}
          >
            <GraduationCap size={18} style={{ color: '#0BB5C7' }} />
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Acadgenius
          </span>
        </Link>
      </div>

      {/* User profile */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {name}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {role === 'admin' ? 'Dashboard Control' : 'Teacher'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact />
        <NavItem href="/dashboard/schedule" icon={CalendarDays} label="Master Schedule" />
        <NavItem href="/dashboard/classes" icon={BookOpen} label="Classes" />
        <NavItem href="/dashboard/teachers" icon={Users} label="Teachers" />
        <NavItem href="/dashboard/settings" icon={Settings} label="Settings" badge={pendingApprovals} />
      </nav>
    </aside>
  )
}
