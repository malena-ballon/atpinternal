import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Globe, DollarSign } from 'lucide-react'
import type { SubjectRow, SessionRow, TeacherRow, StudentRow, ExamRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import SubjectsManager from './components/SubjectsManager'
import SessionsSpreadsheet from './components/SessionsSpreadsheet'
import StudentsManager from './components/StudentsManager'
import ExamsManager from './components/ExamsManager'
import PerformanceInsights from './components/PerformanceInsights'

function Section({ title, children, scrollable }: { title: string; children: React.ReactNode; scrollable?: boolean }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <div style={scrollable ? { maxHeight: 480, overflowY: 'auto' } : undefined}>
        {children}
      </div>
    </div>
  )
}

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cls }, { data: subjects }, { data: sessionsData }, { data: teachersData }, { data: classStudentsData }, { data: examsData }] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).single(),
    supabase.from('subjects').select('id, name, class_id, created_at').eq('class_id', id).order('name'),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, student_count, zoom_link, notes, class_id, subject_id, teacher_id, subjects(name), teachers(name), classes(name)')
      .eq('class_id', id)
      .order('date', { ascending: false }),
    supabase.from('teachers').select('id, user_id, name, specialization, email, availability'),
    supabase.from('class_students')
      .select('enrolled_at, students(id, name, school, email, created_at)')
      .eq('class_id', id)
      .order('enrolled_at', { ascending: false }),
    supabase.from('exams')
      .select('id, class_id, subject_id, name, date, total_items, passing_pct_override, created_at, updated_at, subjects(name)')
      .eq('class_id', id)
      .order('date', { ascending: false }),
  ])

  if (!cls) notFound()

  const students: StudentRow[] = (classStudentsData ?? []).map(cs => ({
    ...(cs.students as StudentRow),
    enrolled_at: cs.enrolled_at,
  }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard/classes" style={{ color: '#0BB5C7' }}>Classes</Link>
        <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ color: 'var(--color-text-secondary)' }}>{cls.name}</span>
      </div>

      {/* Row 1: Class Details + Subjects */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <Section title="Class Details">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{cls.name}</h1>
                <StatusBadge status={cls.status} />
              </div>

              {cls.description && (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {cls.description}
                </p>
              )}

              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                {cls.zoom_link && (
                  <div className="flex items-center gap-2">
                    <Globe size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <a href={cls.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="text-sm hover:underline" style={{ color: '#0BB5C7' }}>
                      Default Zoom Link
                    </a>
                  </div>
                )}
                {cls.rate != null && (
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      ₱{Number(cls.rate).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Default passing:</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {cls.default_passing_pct}%
                  </span>
                </div>
                {cls.at_risk_threshold != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>At-risk below:</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {cls.at_risk_threshold}%
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Public link:</span>
                  <Link href={`/schedule/${cls.id}`} target="_blank"
                    className="text-sm hover:underline" style={{ color: '#0BB5C7' }}>
                    /schedule/{cls.id.slice(0, 8)}…
                  </Link>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="col-span-2">
          <Section title="Subjects">
            <SubjectsManager classId={cls.id} initialSubjects={(subjects ?? []) as SubjectRow[]} />
          </Section>
        </div>
      </div>

      {/* Row 2: Students + Exams (scrollable) */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="Students" scrollable>
          <StudentsManager classId={cls.id} initialStudents={students} />
        </Section>

        <Section title="Exams" scrollable>
          <ExamsManager
            classId={cls.id}
            classPassingPct={cls.default_passing_pct}
            initialExams={(examsData ?? []) as ExamRow[]}
            subjects={(subjects ?? []) as SubjectRow[]}
            classStudents={students}
          />
        </Section>
      </div>

      {/* Performance Insights */}
      <Section title="Performance Insights">
        <PerformanceInsights
          className={cls.name}
          classId={cls.id}
          exams={(examsData ?? []) as ExamRow[]}
          classStudents={students}
          classPassingPct={cls.default_passing_pct}
          atRiskThreshold={cls.at_risk_threshold}
          scoreBrackets={cls.score_brackets}
        />
      </Section>

      {/* Sessions */}
      <Section title="Sessions">
        <SessionsSpreadsheet
          classId={cls.id}
          initialSessions={(sessionsData ?? []) as SessionRow[]}
          subjects={(subjects ?? []) as SubjectRow[]}
          teachers={(teachersData ?? []) as TeacherRow[]}
          initialStudentCount={(sessionsData ?? [])[0]?.student_count ?? 0}
        />
      </Section>
    </div>
  )
}
