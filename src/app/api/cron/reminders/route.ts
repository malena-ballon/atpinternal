import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { resend, FROM_EMAIL } from '@/utils/resend'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

function safeHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try { const u = new URL(url); return u.protocol === 'https:' ? u.href : null } catch { return null }
}

// PH timezone offset in ms (UTC+8)
const PH_OFFSET_MS = 8 * 60 * 60 * 1000

function phDateString(utcMs: number): string {
  const d = new Date(utcMs + PH_OFFSET_MS)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function formatTime(t: string) {
  // t is HH:MM or HH:MM:SS
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function sessionRows(sessions: SessionWithJoins[]): string {
  return sessions
    .map(
      s => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.subjects?.name ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.classes?.name ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          ${safeHttpsUrl(s.zoom_link) ? `<a href="${safeHttpsUrl(s.zoom_link)}" style="color:#0BB5C7;">Join</a>` : '—'}
        </td>
      </tr>`
    )
    .join('')
}

function buildEmail(teacherName: string, dateLabel: string, dateStr: string, sessions: SessionWithJoins[]): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0BB5C7;padding:20px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:700;">ATP Schedule Reminder</span>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#374151;">Hi <strong>${escapeHtml(teacherName)}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;">Here are your sessions for <strong>${dateLabel} (${dateStr})</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Time</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Subject</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Class</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Zoom</th>
          </tr>
        </thead>
        <tbody>${sessionRows(sessions)}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Sent by Acadgenius Tutorial Powerhouse. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`
}

interface SessionWithJoins {
  id: string
  date: string
  start_time: string
  end_time: string
  zoom_link: string | null
  teacher_id: string | null
  subjects: { name: string } | null
  classes: { name: string } | null
  teachers: { name: string; email: string } | null
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') // '24h' | '6h'
  if (type !== '24h' && type !== '6h') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const now = Date.now()
  // For 6h: runs at 22:00 UTC = 06:00 PH next day → target = tomorrow PH date
  // For 24h: runs at 12:00 UTC = 20:00 PH → target = tomorrow PH date
  // Both target TOMORROW in PH time from their UTC run time
  const targetMs = type === '24h'
    ? now + 24 * 60 * 60 * 1000  // 24h from now (run at 20:00 PH → target next day)
    : now + 8 * 60 * 60 * 1000   // 6h from now (run at 06:00 PH → target same day later)
  const targetDate = phDateString(targetMs)

  const supabase = createServiceClient()
  const sentField = type === '24h' ? 'reminder_24h_sent' : 'reminder_6h_sent'

  // Fetch qualifying sessions
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, date, start_time, end_time, zoom_link, teacher_id, subjects(name), classes(name), teachers(name, email)')
    .eq('date', targetDate)
    .in('status', ['scheduled', 'in_progress'])
    .eq(sentField, false)

  if (error) {
    console.error('[cron/reminders] fetch error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No sessions to remind' })
  }

  // Group by teacher_id
  const byTeacher = new Map<string, SessionWithJoins[]>()
  const sentIds: string[] = []

  for (const s of sessions as any[]) {
    if (!s.teacher_id || !s.teachers?.email) continue
    if (!byTeacher.has(s.teacher_id)) byTeacher.set(s.teacher_id, [])
    byTeacher.get(s.teacher_id)!.push(s)
    sentIds.push(s.id)
  }

  const dateLabel = type === '24h' ? 'Tomorrow' : 'Today'
  const dateStr = new Date(targetMs + PH_OFFSET_MS).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  let emailsSent = 0
  for (const [, teacherSessions] of byTeacher) {
    const teacher = teacherSessions[0].teachers!
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: teacher.email,
        subject: `${type === '24h' ? 'Your Schedule for Tomorrow' : "Today's Session Reminder"} – ${targetDate}`,
        html: buildEmail(teacher.name, dateLabel, dateStr, teacherSessions),
      })
      emailsSent++
    } catch (e) {
      console.error('[cron/reminders] send error for', teacher.email, e)
    }
  }

  // Mark reminders sent (only for sessions we grouped, i.e. those with a teacher email)
  if (sentIds.length > 0) {
    await supabase
      .from('sessions')
      .update({ [sentField]: true })
      .in('id', sentIds)
  }

  return NextResponse.json({ sent: emailsSent, sessions: sessions.length })
}
