import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import Sidebar from './components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, status, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') redirect('/pending')

  const { count: pendingApprovals } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const initials = profile.name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar — client component owns all icons internally */}
      <Sidebar
        name={profile.name}
        role={profile.role}
        pendingCount={pendingApprovals ?? 0}
      />

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1" style={{ marginLeft: '240px', minHeight: '100vh' }}>
        {/* Top header */}
        <header
          className="sticky top-0 z-10 flex items-center gap-4 px-8"
          style={{
            height: '64px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Notifications */}
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Bell size={18} />
              {(pendingApprovals ?? 0) > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                />
              )}
            </div>

            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
