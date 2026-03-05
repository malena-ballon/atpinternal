import { createClient } from '@/utils/supabase/server'
import type { TeacherRow } from '@/types'
import TeachersTable from './components/TeachersTable'

export interface TeacherWithStats extends TeacherRow {
  upcomingSessions: number
  totalSessions: number
}

export default async function TeachersPage() {
  const supabase = await createClient()
  const todayStr = new Date().toISOString().split('T')[0]

  const [{ data: teachers }, { data: sessions }] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, user_id, name, specialization, email, availability')
      .order('name'),
    supabase
      .from('sessions')
      .select('teacher_id, status, date'),
  ])

  const statsMap = new Map<string, { upcoming: number; total: number }>()
  sessions?.forEach(s => {
    if (!s.teacher_id) return
    const curr = statsMap.get(s.teacher_id) ?? { upcoming: 0, total: 0 }
    curr.total++
    if (s.status === 'scheduled' && s.date >= todayStr) curr.upcoming++
    statsMap.set(s.teacher_id, curr)
  })

  const data: TeacherWithStats[] = (teachers ?? []).map(t => ({
    ...(t as TeacherRow),
    upcomingSessions: statsMap.get(t.id)?.upcoming ?? 0,
    totalSessions: statsMap.get(t.id)?.total ?? 0,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Teachers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {data.length} teacher{data.length !== 1 ? 's' : ''} registered
        </p>
      </div>
      <TeachersTable initialTeachers={data} />
    </div>
  )
}
