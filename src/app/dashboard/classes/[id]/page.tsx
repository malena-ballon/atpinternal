import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { SubjectRow, SessionRow, TeacherRow, StudentRow, ExamRow, ClassRow } from '@/types'
import ClassTabs from './components/ClassTabs'
import { sanitizeRichHtml } from '@/lib/sanitize'

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cls }, { data: subjects }, { data: sessionsData }, { data: teachersData }, { data: classStudentsData }, { data: examsData }] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).single(),
    supabase.from('subjects').select('id, name, class_id, created_at').eq('class_id', id).order('name'),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, student_count, zoom_link, notes, topic, class_id, subject_id, subject_ids, is_assessment, teacher_id, subjects(name), teachers(name), classes(name)')
      .eq('class_id', id)
      .order('date', { ascending: true })
      .order('start_time'),
    supabase.from('teachers').select('id, user_id, name, specialization, email, availability'),
    supabase.from('class_students')
      .select('enrolled_at, students(id, name, school, email, created_at)')
      .eq('class_id', id)
      .order('enrolled_at', { ascending: false }),
    supabase.from('exams')
      .select('id, class_id, subject_id, subject_ids, name, date, total_items, passing_pct_override, created_at, updated_at, subjects(name)')
      .eq('class_id', id)
      .order('date', { ascending: false }),
  ])

  if (!cls) notFound()
  if (cls.public_notes) cls.public_notes = sanitizeRichHtml(cls.public_notes)

  const students: StudentRow[] = (classStudentsData ?? []).map(cs => ({
    ...(cs.students as unknown as StudentRow),
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

      <ClassTabs
        cls={cls as unknown as ClassRow}
        subjects={(subjects ?? []) as SubjectRow[]}
        sessionsData={(sessionsData ?? []) as unknown as SessionRow[]}
        teachersData={(teachersData ?? []) as TeacherRow[]}
        students={students}
        examsData={(examsData ?? []) as unknown as ExamRow[]}
      />
    </div>
  )
}
