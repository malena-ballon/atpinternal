'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  BookMarked,
  LogOut,
  HeartIcon,
  Activity,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { signOut } from '@/app/actions'
import AvatarUpload from './AvatarUpload'

export const SIDEBAR_WIDTH = 240
export const SIDEBAR_COLLAPSED_WIDTH = 64

interface NavItemProps {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  exact?: boolean
  collapsed: boolean
}

function NavItem({ href, icon: Icon, label, badge, exact, collapsed }: NavItemProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative group"
      style={{
        backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
        justifyContent: collapsed ? 'center' : undefined,
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{ backgroundColor: '#3DD4E6', color: '#0A1045' }}
        >
          {badge}
        </span>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{ backgroundColor: '#3DD4E6' }}
        />
      )}
      {/* Tooltip on collapse */}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{ backgroundColor: '#0A1045', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          {label}
          {badge !== undefined && badge > 0 && ` (${badge})`}
        </span>
      )}
    </Link>
  )
}

interface Props {
  name: string
  role: string
  avatarUrl: string | null
  pendingCount?: number
}

export default function Sidebar({ name, role, avatarUrl, pendingCount = 0 }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
  }

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <aside
      className="flex flex-col transition-all duration-300"
      style={{
        width,
        minWidth: width,
        backgroundColor: '#0A1045',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center py-5 transition-all duration-300"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: collapsed ? '20px 0' : '20px',
          justifyContent: collapsed ? 'center' : undefined,
        }}
      >
        {collapsed ? (
          <div className="flex items-center justify-center">
            <Image src="/logo.jpg" alt="ATP" width={28} height={28} className="rounded-lg" />
          </div>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-1 min-w-0">
            <Image src="/logo.jpg" alt="Acadgenius Tutorial Powerhouse" width={32} height={32} className="rounded-lg flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold leading-tight truncate" style={{ color: '#FFFFFF' }}>
                Acadgenius
              </span>
              <span className="text-xs font-medium leading-tight truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Tutorial Powerhouse
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* User profile */}
      {!collapsed ? (
        <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <AvatarUpload name={name} avatarUrl={avatarUrl} size={36} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{name}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {role === 'admin' ? 'Admin' : 'Teacher'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <AvatarUpload name={name} avatarUrl={avatarUrl} size={32} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact collapsed={collapsed} />
        <NavItem href="/dashboard/schedule" icon={CalendarDays} label="Master Schedule" collapsed={collapsed} />
        <NavItem href="/dashboard/classes" icon={BookOpen} label="Classes" collapsed={collapsed} />
        <NavItem href="/dashboard/teachers" icon={Users} label="Teachers" badge={pendingCount} collapsed={collapsed} />
        {role === 'admin' && (
          <>
            <NavItem href="/dashboard/activity" icon={Activity} label="Activity Log" collapsed={collapsed} />
            <NavItem href="/dashboard/email" icon={Mail} label="Email" collapsed={collapsed} />
            <NavItem href="/dashboard/notebook" icon={BookMarked} label="Notebook" collapsed={collapsed} />
            <NavItem href="/dashboard/malena" icon={HeartIcon} label="Malena" collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Collapse / Expand toggle + Sign out */}
      <div className="px-2 pb-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        {/* Collapse/Expand button */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all hover:bg-white/10 text-sm font-medium"
          style={{
            color: 'rgba(255,255,255,0.55)',
            justifyContent: collapsed ? 'center' : undefined,
          }}
        >
          {collapsed ? <ChevronRight size={18} style={{ flexShrink: 0 }} /> : <ChevronLeft size={18} style={{ flexShrink: 0 }} />}
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>

        {/* Sign out */}
        <form action={signOut}>
          <button
            type="submit"
            title={collapsed ? 'Sign Out' : undefined}
            className="cursor-pointer hover:bg-white/10 hover:text-white active:scale-95 active:bg-white/20 flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
            style={{
              color: 'rgba(255,255,255,0.65)',
              justifyContent: collapsed ? 'center' : undefined,
            }}
          >
            <LogOut size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
