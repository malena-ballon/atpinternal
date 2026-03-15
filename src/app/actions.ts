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

// ── Teacher approval ───────────────────────────────────────────────────────────
export async function approveUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { data: u } = await supabase.from('users').select('name, email').eq('id', userId).single()
  if (!u) return { ok: false, error: 'User not found' }
  const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  // Link existing teacher row by email, or create one
  const { data: existing } = await supabase.from('teachers').select('id').eq('email', u.email).maybeSingle()
  if (existing) {
    await supabase.from('teachers').update({ user_id: userId }).eq('id', existing.id)
  } else {
    await supabase.from('teachers').insert({ user_id: userId, name: u.name, email: u.email })
  }
  return { ok: true }
}

export async function rejectUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Registration ───────────────────────────────────────────────────────────────
// Called after supabase.auth.signUp() on the client. Uses service client to
// reliably create the users row (in case the DB trigger hasn't been applied).
// If the registering email matches an invited teacher, auto-approves them.
export async function ensureUserProfile(
  userId: string,
  name: string,
  email: string
): Promise<{ status: 'active' | 'pending' }> {
  const supabase = createServiceClient()

  // Check if this email belongs to an invited (unlinked) teacher
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('email', email)
    .is('user_id', null)
    .maybeSingle()

  const status: 'active' | 'pending' = teacher ? 'active' : 'pending'

  // Upsert the users row — handles both trigger-already-ran and trigger-missing cases
  await supabase.from('users').upsert(
    { id: userId, name, email, role: 'teacher', status },
    { onConflict: 'id' }
  )

  // Link the teacher record if this was an invited user
  if (teacher) {
    await supabase.from('teachers').update({ user_id: userId }).eq('id', teacher.id)
  }

  return { status }
}

// ── Invite teacher ─────────────────────────────────────────────────────────────
export async function sendTeacherInvite(teacherId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, email')
    .eq('id', teacherId)
    .single()

  if (!teacher) return { ok: false, error: 'Teacher not found' }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const registerUrl = `${baseUrl}/register?email=${encodeURIComponent(teacher.email)}`

  const replyTo = await getReplyTo()
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: teacher.email,
    ...(replyTo ? { replyTo } : {}),
    subject: "You're invited to join ATP Internal",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#0A1045;margin:0 0 8px;">You've been invited!</h2>
        <p style="color:#334155;margin:0 0 16px;">Hi ${teacher.name},</p>
        <p style="color:#334155;margin:0 0 16px;">You've been added as a teacher on the Acadgenius Tutorial Powerhouse internal platform. Click the button below to create your account — no approval needed.</p>
        <a href="${registerUrl}" style="display:inline-block;background:#0BB5C7;color:#0A1045;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin:4px 0 24px;">
          Create My Account
        </a>
        <p style="color:#94a3b8;font-size:12px;margin:0;">Or copy this link:<br>${registerUrl}</p>
      </div>
    `.trim(),
  })

  if (error) return { ok: false, error: error.message }
  await logSentEmail({
    subject: "You're invited to join ATP Internal",
    toAddresses: [{ name: teacher.name, email: teacher.email }],
    type: 'invite',
    context: teacher.name,
    body: `Hi ${teacher.name}, you've been added as a teacher on the Acadgenius Tutorial Powerhouse internal platform. A registration link was included so they can create their account without requiring approval.`,
    sentCount: 1,
    failedCount: 0,
  })
  return { ok: true }
}

// ── Public notes ───────────────────────────────────────────────────────────────
export async function savePublicNotes(classId: string, html: string, position: 'above' | 'below'): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('classes')
    .update({ public_notes: html || null, public_notes_position: position })
    .eq('id', classId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Activity logging ───────────────────────────────────────────────────────────
export async function logActivity(
  action: string,
  entityType: string,
  entityId: string | null,
  entityName: string | null,
  description: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  const svc = createServiceClient()
  const base = {
    user_id: user.id,
    user_name: profile?.name ?? 'Unknown',
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    description,
  }
  // Try with user_role first; fall back without it if the column doesn't exist yet
  const { error: e1 } = await svc.from('activity_logs').insert({ ...base, user_role: profile?.role ?? 'teacher' })
  if (e1) {
    await svc.from('activity_logs').insert(base)
  }
}

// ── Teacher profile save (service client — bypasses RLS for teacher self-edits) ─
export async function saveTeacher(
  payload: { name: string; email: string; specialization: string | null; availability: unknown },
  teacherId?: string
): Promise<{ data: { id: string; user_id: string | null; name: string; specialization: string | null; email: string; availability: unknown } | null; error?: string }> {
  const supabase = createServiceClient()
  if (teacherId) {
    const { data, error } = await supabase
      .from('teachers')
      .update(payload)
      .eq('id', teacherId)
      .select('id, user_id, name, specialization, email, availability')
      .single()
    if (error) return { data: null, error: error.message }
    return { data }
  } else {
    const { data, error } = await supabase
      .from('teachers')
      .insert(payload)
      .select('id, user_id, name, specialization, email, availability')
      .single()
    if (error) return { data: null, error: error.message }
    return { data }
  }
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

  const replyToTeacher = await getReplyTo()
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
      const sessSubject = `New Sessions Assigned – ${(teacherSessions[0] as { classes?: { name: string }[] | null }).classes?.[0]?.name ?? 'ATP'}`
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: teacher.email,
        ...(replyToTeacher ? { replyTo: replyToTeacher } : {}),
        subject: sessSubject,
        html,
      })
      if (error) console.error('[sendTeacherSessionEmail] Resend error for', teacher.email, error)
      else {
        sent++
        const sessionLines = teacherSessions.map(s => {
          const cls = (s as { classes?: { name: string }[] | null }).classes?.[0]?.name ?? '—'
          const subj = (s as { subjects?: { name: string }[] | null }).subjects?.[0]?.name ?? '—'
          return `• ${s.date}  ${s.start_time ? fmtTime(s.start_time) + ' – ' + fmtTime(s.end_time ?? '') : 'Time TBD'}  |  ${subj}  |  ${cls}`
        }).join('\n')
        await logSentEmail({
          subject: sessSubject,
          toAddresses: [{ name: teacher.name, email: teacher.email }],
          type: 'session_notify',
          context: (teacherSessions[0] as { classes?: { name: string }[] | null }).classes?.[0]?.name,
          body: `Hi ${teacher.name}, you have been assigned to ${teacherSessions.length} session(s):\n\n${sessionLines}`,
          sentCount: 1,
          failedCount: 0,
        })
      }
    } catch (e) {
      console.error('[sendTeacherSessionEmail] failed for', teacher.email, e)
    }
  }
  return { sent }
}

// ── Send session schedule to a student ────────────────────────────────────────
export async function emailSessionSchedule(
  studentId: string,
  classId: string,
  sessionIds?: string[],
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const supabase = createServiceClient()

  const { data: student } = await supabase
    .from('students')
    .select('id, name, email')
    .eq('id', studentId)
    .single()
  if (!student) return { ok: false, skipped: false, error: 'Student not found' }
  if (!student.email) return { ok: false, skipped: true }

  const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
  const className = cls?.name ?? 'Class'

  let query = supabase
    .from('sessions')
    .select('id, date, start_time, end_time, status, subjects(name), teachers(name)')
    .eq('class_id', classId)
    .order('date')
    .order('start_time')
  if (sessionIds && sessionIds.length > 0) query = query.in('id', sessionIds)
  const { data: sessions } = await query

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { default: SessionSchedulePDF } = await import('./dashboard/classes/[id]/components/pdf/SessionSchedulePDF')
    const React = await import('react')

    const rows = (sessions ?? []).map((s, i) => {
      const d = s.date
      let day = '—'
      try { day = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) } catch {}
      const teacher = (s as any).teachers?.name ?? (s as any).teachers?.[0]?.name ?? '—'
      const subject = (s as any).subjects?.name ?? (s as any).subjects?.[0]?.name ?? '—'
      return {
        index: i + 1,
        date: d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        day,
        startTime: s.start_time?.slice(0, 5) ?? '',
        endTime: s.end_time?.slice(0, 5) ?? '',
        teacher,
        subject,
        status: s.status,
      }
    })

    const buffer = await renderToBuffer(
      React.createElement(SessionSchedulePDF, { className, sessions: rows }) as any
    )

    const today = new Date().toISOString().slice(0, 10)
    const safeName = student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')

    const schedReplyTo = await getReplyTo()
    const schedSubject = `Session Schedule – ${className}`
    const schedFilename = `${safeName}_${className.replace(/\s+/g, '-')}_schedule_${today}.pdf`
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: student.email,
      ...(schedReplyTo ? { replyTo: schedReplyTo } : {}),
      subject: schedSubject,
      html: `
<div style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:0 auto;">
  <div style="background:#0BB5C7;padding:16px 20px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:16px;font-weight:700;">Session Schedule</span>
  </div>
  <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;color:#374151;">Hi <strong>${student.name}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151;">Please find the session schedule for <strong>${className}</strong> attached.</p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by Acadgenius Tutorial Powerhouse.</p>
  </div>
</div>`,
      attachments: [{ filename: schedFilename, content: buffer }],
    })
    if (sendError) {
      console.error('[emailSessionSchedule] Resend error', sendError)
      return { ok: false, skipped: false, error: sendError.message }
    }
    const schedStoragePath = await uploadToEmailStorage(buffer, schedFilename)
    await logSentEmail({
      subject: schedSubject,
      toAddresses: [{ name: student.name, email: student.email }],
      type: 'schedule',
      context: className,
      body: `Hi ${student.name}, please find the session schedule for ${className} attached as a PDF. The schedule includes ${sessions?.length ?? 0} session(s).`,
      attachments: schedStoragePath ? [{ filename: schedFilename, storage_path: schedStoragePath, recipient_email: student.email }] : [{ filename: schedFilename }],
      sentCount: 1,
      failedCount: 0,
    })
    return { ok: true, skipped: false }
  } catch (e) {
    console.error('[emailSessionSchedule] failed', e)
    return { ok: false, skipped: false, error: String(e) }
  }
}

// ── Send report emails (with PDF attachments) ─────────────────────────────────
export async function sendReportEmails(
  recipients: {
    name: string
    email: string
    pdfs: { filename: string; base64: string }[]
  }[],
  subject: string,
  body: string,
  signature: string,
  extraAttachments: { filename: string; base64: string }[]
): Promise<{ sent: number; failed: number }> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const replyToReport = await getReplyTo()
  let sent = 0
  let failed = 0
  const allAttachments: { filename: string; storage_path?: string; recipient_email?: string }[] = []

  // Upload extra (shared) attachments to storage
  const extraStored = await Promise.all(
    extraAttachments.map(async a => {
      const path = await uploadToEmailStorage(Buffer.from(a.base64, 'base64'), a.filename)
      return { filename: a.filename, storage_path: path ?? undefined }
    })
  )
  allAttachments.push(...extraStored)

  for (const r of recipients) {
    try {
      const html = `
<div style="font-family:system-ui,sans-serif;padding:24px;max-width:540px;margin:0 auto;">
  <div style="background:#0BB5C7;padding:16px 20px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:16px;font-weight:700;">Report</span>
  </div>
  <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;color:#374151;">Hi <strong>${esc(r.name)}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151;white-space:pre-wrap;">${esc(body)}</p>
    ${signature ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/><p style="margin:0;font-size:12px;color:#6b7280;white-space:pre-wrap;">${esc(signature)}</p>` : ''}
    <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">Sent by Acadgenius Tutorial Powerhouse.</p>
  </div>
</div>`
      const pdfAttachments = r.pdfs.map(p => ({
        filename: p.filename,
        content: Buffer.from(p.base64, 'base64'),
      }))
      const extraAttach = extraAttachments.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.base64, 'base64'),
      }))
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        ...(replyToReport ? { replyTo: replyToReport } : {}),
        subject,
        html,
        attachments: [...pdfAttachments, ...extraAttach],
      })
      if (error) {
        console.error('[sendReportEmails] failed for', r.email, error)
        failed++
      } else {
        sent++
        // Upload per-recipient PDFs to storage concurrently
        const uploaded = await Promise.all(
          r.pdfs.map(async pdf => {
            const path = await uploadToEmailStorage(Buffer.from(pdf.base64, 'base64'), pdf.filename)
            return { filename: pdf.filename, storage_path: path ?? undefined, recipient_email: r.email }
          })
        )
        allAttachments.push(...uploaded)
      }
    } catch (e) {
      console.error('[sendReportEmails] exception for', r.email, e)
      failed++
    }
  }
  await logSentEmail({
    subject,
    toAddresses: recipients.map(r => ({ name: r.name, email: r.email })),
    type: 'report',
    body: signature ? `${body}\n\n—\n${signature}` : body,
    attachments: allAttachments,
    sentCount: sent,
    failedCount: failed,
  })
  return { sent, failed }
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
      } as any) as any
    )

    const today = new Date().toISOString().slice(0, 10)
    const safeName = student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')

    const reportReplyTo = await getReplyTo()
    const reportSubject = `Your Performance Report – ${className}`
    const reportFilename = `${safeName}_${className.replace(/\s+/g, '-')}_${today}.pdf`
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: student.email,
      ...(reportReplyTo ? { replyTo: reportReplyTo } : {}),
      subject: reportSubject,
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
      attachments: [{ filename: reportFilename, content: buffer }],
    })
    if (sendError) {
      console.error('[emailStudentReport] Resend error', sendError)
      return { ok: false, skipped: false, error: sendError.message }
    }
    const reportStoragePath = await uploadToEmailStorage(buffer, reportFilename)
    await logSentEmail({
      subject: reportSubject,
      toAddresses: [{ name: student.name, email: student.email }],
      type: 'report',
      context: className,
      body: `Hi ${student.name}, please find your performance report for ${className} attached as a PDF. The report covers ${sortedExams.length} exam(s) with an average score of ${Math.round(avgPct)}%.`,
      attachments: reportStoragePath ? [{ filename: reportFilename, storage_path: reportStoragePath, recipient_email: student.email }] : [{ filename: reportFilename }],
      sentCount: 1,
      failedCount: 0,
    })
    return { ok: true, skipped: false }
  } catch (e) {
    console.error('[emailStudentReport] failed', e)
    return { ok: false, skipped: false, error: String(e) }
  }
}

// ── Email inbox helpers ────────────────────────────────────────────────────────

async function getReplyTo(): Promise<string | undefined> {
  const svc = createServiceClient()
  const { data } = await svc.from('email_settings').select('reply_to').eq('id', 1).single()
  return data?.reply_to ?? undefined
}

async function uploadToEmailStorage(buffer: Buffer, filename: string): Promise<string | null> {
  try {
    const svc = createServiceClient()
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}_${filename}`
    const { error } = await svc.storage.from('email-attachments').upload(path, buffer, { contentType: 'application/pdf' })
    if (error) { console.error('[uploadToEmailStorage]', error.message); return null }
    return path
  } catch (e) {
    console.error('[uploadToEmailStorage] exception:', e)
    return null
  }
}

export async function getEmailAttachmentUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const svc = createServiceClient()
  const { data, error } = await svc.storage.from('email-attachments').createSignedUrl(storagePath, 3600)
  if (error || !data) return { error: error?.message ?? 'Failed to generate URL' }
  return { url: data.signedUrl }
}

async function getCurrentUserName(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'System'
    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    return profile?.name ?? 'System'
  } catch {
    return 'System'
  }
}

async function logSentEmail(opts: {
  subject: string
  toAddresses: { name: string; email: string }[]
  type: string
  context?: string
  body?: string
  attachments?: { filename: string; storage_path?: string; recipient_email?: string }[]
  sentCount: number
  failedCount: number
}): Promise<void> {
  try {
    const svc = createServiceClient()
    const sentBy = await getCurrentUserName()
    const { error } = await svc.from('sent_emails').insert({
      subject: opts.subject,
      to_addresses: opts.toAddresses,
      type: opts.type,
      context: opts.context ?? null,
      body: opts.body ?? null,
      sent_by: sentBy,
      attachments: opts.attachments ?? [],
      sent_count: opts.sentCount,
      failed_count: opts.failedCount,
    })
    if (error) console.error('[logSentEmail] insert failed:', error.message)
  } catch (e) {
    console.error('[logSentEmail] exception:', e)
  }
}

export async function getEmailSettings(): Promise<{ reply_to: string | null }> {
  const svc = createServiceClient()
  const { data } = await svc.from('email_settings').select('reply_to').eq('id', 1).single()
  return { reply_to: data?.reply_to ?? null }
}

export async function saveEmailSettings(replyTo: string): Promise<{ ok: boolean; error?: string }> {
  const svc = createServiceClient()
  const { error } = await svc.from('email_settings')
    .update({ reply_to: replyTo || null, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteEmails(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!ids.length) return { ok: true }
  const svc = createServiceClient()
  // Fetch storage paths before deleting rows
  const { data: rows } = await svc.from('sent_emails').select('attachments').in('id', ids)
  const storagePaths = (rows ?? []).flatMap(r =>
    ((r.attachments ?? []) as { storage_path?: string }[])
      .map(a => a.storage_path)
      .filter(Boolean) as string[]
  )
  if (storagePaths.length > 0) {
    await svc.storage.from('email-attachments').remove(storagePaths)
  }
  const { error } = await svc.from('sent_emails').delete().in('id', ids)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
