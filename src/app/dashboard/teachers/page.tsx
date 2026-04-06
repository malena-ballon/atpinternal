import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import type { TeacherRow } from '@/types'
import TeachersTable from './components/TeachersTable'

export interface TeacherWithStats extends TeacherRow {
  upcomingSessions: number
  totalSessions: number
}

export interface PendingUser {
  id: string
  name: string
  email: string
  created_at: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  created_at: string
  avatar_url: string | null
}

export default async function TeachersPage() {
  const supabase = await createClient()
  const serviceClient = createServiceClient()
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: currentUser }, { data: currentTeacherRow }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user!.id).single(),
    supabase.from('teachers').select('id').eq('user_id', user!.id).maybeSingle(),
  ])
  const currentUserRole = (currentUser?.role ?? 'teacher') as 'admin' | 'teacher'
  const currentTeacherId = currentTeacherRow?.id ?? null

  const [{ data: teachers }, { data: sessions }, { data: pendingUsers }, { data: adminUsers }] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, user_id, name, specialization, email, availability')
      .order('name'),
    supabase
      .from('sessions')
      .select('teacher_id, status, date'),
    serviceClient
      .from('users')
      .select('id, name, email, created_at')
      .eq('status', 'pending')
      .eq('role', 'teacher')
      .order('created_at'),
    serviceClient
      .from('users')
      .select('id, name, email, created_at, avatar_url')
      .eq('role', 'admin')
      .eq('status', 'active')
      .order('name'),
  ])

  const statsMap = new Map<string, { upcoming: number; total: number }>()
  sessions?.forEach(s => {
    if (!s.teacher_id) return
    const curr = statsMap.get(s.teacher_id) ?? { upcoming: 0, total: 0 }
    curr.total++
    if (s.status === 'scheduled' && s.date >= todayStr) curr.upcoming++
    statsMap.set(s.teacher_id, curr)
  })

  const allTeachers: TeacherWithStats[] = (teachers ?? []).map(t => ({
    ...(t as TeacherRow),
    upcomingSessions: statsMap.get(t.id)?.upcoming ?? 0,
    totalSessions: statsMap.get(t.id)?.total ?? 0,
  }))

  const activeTeachers = allTeachers.filter(t => t.user_id != null)
  const invitedTeachers = allTeachers.filter(t => t.user_id == null)
  const pending = (pendingUsers ?? []) as PendingUser[]
  const admins = (adminUsers ?? []) as AdminUser[]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Teachers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {activeTeachers.length} active · {pending.length} pending · {invitedTeachers.length} invited · {admins.length} admin{admins.length !== 1 ? 's' : ''}
        </p>
      </div>
      <TeachersTable
        activeTeachers={activeTeachers}
        pendingUsers={pending}
        invitedTeachers={invitedTeachers}
        admins={admins}
        currentUserRole={currentUserRole}
        currentTeacherId={currentTeacherId}
      />
    </div>
  )
}
