import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OverviewCards from './components/OverviewCards'
import SessionsPerProgram from './components/SessionsPerProgram'
import TodayAndUpcomingSessions, { type SessionRow as TodaySessionRow } from './components/TodayAndUpcomingSessions'
import UpcomingSessionsCard, { type UpcomingSession } from './components/UpcomingSessionsCard'
import SubjectAverages, { type SubjectAvgClass, type SubjectAvgSubject, type SubjectAvgExam, type SubjectAvgScore } from './components/SubjectAverages'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') redirect('/pending')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]
  const [
    { count: totalSessions },
    { count: thisMonthSessions },
    { data: allSessionStatuses },
    { count: activePrograms },
    { count: activeTeachers },
    { count: pendingApprovals },
    { data: enrollmentData },
    { data: programsData },
    { data: todaySessions },
    { data: upcomingSessions },
    { data: activeClassesData },
    { data: subjectsData },
    { data: examsData },
    { data: scoresData },
  ] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }),
    supabase.from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase.from('sessions').select('status'),
    supabase.from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('status', 'active'),
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('class_students').select('student_id'),
    supabase.from('classes')
      .select('id, name, sessions(status)')
      .eq('status', 'active'),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, student_count, zoom_link, subjects(name), teachers(name), classes(name)')
      .eq('date', todayStr)
      .order('start_time'),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, subjects(name), teachers(name), classes(name)')
      .gt('date', todayStr)
      .eq('status', 'scheduled')
      .order('date')
      .order('start_time')
      .limit(3),
    supabase.from('classes').select('id, name').eq('status', 'active').order('name'),
    supabase.from('subjects').select('id, name, class_id'),
    supabase.from('exams').select('id, class_id, subject_id, subject_ids'),
    supabase.from('scores').select('exam_id, percentage'),
  ])

  const enrolledStudents = new Set(enrollmentData?.map(e => e.student_id) ?? []).size

  const statusCounts = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, rescheduled: 0 }
  allSessionStatuses?.forEach(({ status }) => {
    if (status in statusCounts) statusCounts[status as keyof typeof statusCounts]++
  })

  const programs = (programsData ?? []).map((p) => {
    const sessions = (p.sessions as { status: string }[]) ?? []
    const total = sessions.length
    const done = sessions.filter(s => s.status === 'completed').length
    return {
      id: p.id,
      name: p.name,
      total,
      upcoming: sessions.filter(s => s.status === 'scheduled').length,
      done,
      cancelled: sessions.filter(s => s.status === 'cancelled').length,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Real-time metrics and upcoming sessions for ATP.
        </p>
      </div>

      {/* Stat cards */}
      <OverviewCards
        totalSessions={totalSessions ?? 0}
        thisMonthSessions={thisMonthSessions ?? 0}
        statusCounts={statusCounts}
        activePrograms={activePrograms ?? 0}
        activeTeachers={activeTeachers ?? 0}
        enrolledStudents={enrolledStudents}
        pendingApprovals={pendingApprovals ?? 0}
      />

      {/* Main section */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '3fr 2fr' }}>
        <SessionsPerProgram programs={programs} />
        <div className="flex flex-col gap-6">
          <TodayAndUpcomingSessions todaySessions={(todaySessions ?? []) as unknown as TodaySessionRow[]} />
          <UpcomingSessionsCard sessions={(upcomingSessions ?? []) as unknown as UpcomingSession[]} />
        </div>
      </div>

      {/* Per-subject average across classes */}
      <SubjectAverages
        classes={(activeClassesData ?? []) as SubjectAvgClass[]}
        subjects={(subjectsData ?? []) as SubjectAvgSubject[]}
        exams={(examsData ?? []) as SubjectAvgExam[]}
        scores={(scoresData ?? []) as SubjectAvgScore[]}
      />
    </div>
  )
}
