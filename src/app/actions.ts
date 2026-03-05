'use server'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import { resend, FROM_EMAIL } from '@/utils/resend'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function sessionTableRows(sessions: { date: string; start_time: string; end_time: string; subjects?: { name: string } | null; classes?: { name: string } | null; zoom_link?: string | null }[]): string {
  return sessions.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.subjects?.name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.classes?.name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.zoom_link ? `<a href="${s.zoom_link}" style="color:#0BB5C7;">Join</a>` : '—'}</td>
    </tr>`).join('')
}

// ── Send teacher session notification ─────────────────────────────────────────
export async function sendTeacherSessionEmail(sessionIds: string[]): Promise<{ sent: number }> {
  if (!sessionIds.length) return { sent: 0 }
  const supabase = createServiceClient()
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date, start_time, end_time, zoom_link, teacher_id, subjects(name), classes(name), teachers(name, email)')
    .in('id', sessionIds)

  if (!sessions?.length) return { sent: 0 }

  // Group by teacher
  const byTeacher = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const tid = s.teacher_id as string | null
    if (!tid) continue
    if (!byTeacher.has(tid)) byTeacher.set(tid, [])
    byTeacher.get(tid)!.push(s)
  }

  let sent = 0
  for (const [, teacherSessions] of byTeacher) {
    const teacherData = (teacherSessions[0] as { teachers?: { name: string; email: string }[] | null }).teachers
    const teacher = teacherData?.[0]
    if (!teacher?.email) continue
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0BB5C7;padding:20px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:700;">New Sessions Assigned</span>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#374151;">Hi <strong>${teacher.name}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;">You have been assigned to the following session(s):</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Date</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Time</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Subject</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Class</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Zoom</th>
          </tr>
        </thead>
        <tbody>${sessionTableRows(teacherSessions as any)}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Sent by Acadgenius Tutorial Powerhouse.</p>
    </div>
  </div>
</body></html>`
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: teacher.email,
        subject: `New Sessions Assigned – ${(teacherSessions[0] as { classes?: { name: string }[] | null }).classes?.[0]?.name ?? 'ATP'}`,
        html,
      })
      sent++
    } catch (e) {
      console.error('[sendTeacherSessionEmail] failed for', teacher.email, e)
    }
  }
  return { sent }
}

// ── Send student PDF report ────────────────────────────────────────────────────
export async function emailStudentReport(
  studentId: string,
  classId: string,
  classPassingPct: number,
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const supabase = createServiceClient()

  // Fetch student
  const { data: student } = await supabase
    .from('students')
    .select('id, name, email, school, created_at')
    .eq('id', studentId)
    .single()
  if (!student) return { ok: false, skipped: false, error: 'Student not found' }
  if (!student.email) return { ok: false, skipped: true }

  // Fetch class
  const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
  const className = cls?.name ?? 'Class'

  // Fetch exams for class
  const { data: exams } = await supabase
    .from('exams')
    .select('id, class_id, subject_id, name, date, total_items, passing_pct_override, created_at, updated_at, subjects(name)')
    .eq('class_id', classId)
    .order('date')
  const sortedExams = (exams ?? []).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  // Fetch student's scores
  const { data: scores } = await supabase
    .from('scores')
    .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at, students(name, email)')
    .eq('student_id', studentId)
    .in('exam_id', sortedExams.map(e => e.id))

  // Fetch total students in class
  const { count: totalStudents } = await supabase
    .from('class_students')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)

  // Compute stats (same logic as PerformanceInsights)
  const enriched = (scores ?? [])
    .map(s => ({ ...s, exam: sortedExams.find(e => e.id === s.exam_id)! }))
    .filter(s => s.exam)
    .sort((a, b) => (a.exam.date ?? '').localeCompare(b.exam.date ?? ''))

  const pcts = enriched.map(s => s.percentage)
  const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0

  let trend: 'improving' | 'steady' | 'declining' = 'steady'
  if (enriched.length >= 2) {
    const mid = Math.ceil(enriched.length / 2)
    const firstHalf = enriched.slice(0, mid).reduce((a, s) => a + s.percentage, 0) / mid
    const secondHalf = enriched.slice(mid).reduce((a, s) => a + s.percentage, 0) / Math.max(enriched.length - mid, 1)
    const delta = secondHalf - firstHalf
    if (delta > 5) trend = 'improving'
    else if (delta < -5) trend = 'declining'
  }

  const examPcts = enriched.map(s => ({ exam: s.exam, pct: s.percentage }))
  const highest = examPcts.length > 0 ? examPcts.reduce((m, x) => x.pct > m.pct ? x : m) : null
  const lowest = examPcts.length > 0 ? examPcts.reduce((m, x) => x.pct < m.pct ? x : m) : null

  const stats = {
    student: { id: student.id, name: student.name, email: student.email, school: student.school ?? null, created_at: student.created_at },
    scores: enriched,
    avgPct,
    rank: 0, // rank not needed for single report
    percentile: 0,
    examsTaken: enriched.length,
    trend,
    highest,
    lowest,
  }

  // Generate PDF
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { default: StudentReportPDF } = await import('./dashboard/classes/[id]/components/pdf/StudentReportPDF')
    const React = await import('react')

    const buffer = await renderToBuffer(
      React.createElement(StudentReportPDF, {
        className,
        stats,
        totalStudents: totalStudents ?? 0,
        totalExams: sortedExams.length,
        classPassingPct,
      })
    )

    const today = new Date().toISOString().slice(0, 10)
    const safeName = student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')

    await resend.emails.send({
      from: FROM_EMAIL,
      to: student.email,
      subject: `Your Performance Report – ${className}`,
      html: `
<div style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:0 auto;">
  <div style="background:#0BB5C7;padding:16px 20px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:16px;font-weight:700;">Performance Report</span>
  </div>
  <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;color:#374151;">Hi <strong>${student.name}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151;">Please find your performance report for <strong>${className}</strong> attached.</p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by Acadgenius Tutorial Powerhouse.</p>
  </div>
</div>`,
      attachments: [{
        filename: `${safeName}_${className.replace(/\s+/g, '-')}_${today}.pdf`,
        content: buffer,
      }],
    })
    return { ok: true, skipped: false }
  } catch (e) {
    console.error('[emailStudentReport] failed', e)
    return { ok: false, skipped: false, error: String(e) }
  }
}
