'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
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
} from 'lucide-react'
import { signOut } from '@/app/actions'
import AvatarUpload from './AvatarUpload'

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
        backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{ backgroundColor: '#3DD4E6', color: '#0A1045' }}
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
  avatarUrl: string | null
  pendingCount?: number
}

export default function Sidebar({ name, role, avatarUrl, pendingCount = 0 }: Props) {

  return (
    <aside
      className="flex flex-col"
      style={{
        width: '240px',
        backgroundColor: '#0A1045',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="Acadgenius Tutorial Powerhouse" width={32} height={32} className="rounded-lg" />
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight" style={{ color: '#FFFFFF' }}>
              Acadgenius
            </span>
            <span className="text-xs font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Tutorial Powerhouse
            </span>
          </div>
        </Link>
      </div>

      {/* User profile */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <AvatarUpload name={name} avatarUrl={avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>
              {name}
            </p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {role === 'admin' ? 'Admin' : 'Teacher'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact />
        <NavItem href="/dashboard/schedule" icon={CalendarDays} label="Master Schedule" />
        <NavItem href="/dashboard/classes" icon={BookOpen} label="Classes" />
        <NavItem href="/dashboard/teachers" icon={Users} label="Teachers" badge={pendingCount} />
        {role === 'admin' && (
          <>
            <NavItem href="/dashboard/activity" icon={Activity} label="Activity Log" />
            <NavItem href="/dashboard/email" icon={Mail} label="Email" />
            <NavItem href="/dashboard/notebook" icon={BookMarked} label="Notebook" />
            <NavItem href="/dashboard/malena" icon={HeartIcon} label="Malena" />
          </>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        <form action={signOut}>
          <button
            type="submit"
            // Look at the new 'active:' classes added right here!
            className="cursor-pointer hover:bg-white/10 hover:text-white active:scale-95 active:bg-white/20 flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            <LogOut size={18} strokeWidth={2} />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
