'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, Mail, CheckCircle2 } from 'lucide-react'
import { format, parseISO, addWeeks } from 'date-fns'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import { sendTeacherSessionEmail } from '@/app/actions'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow, SubjectRow } from '@/types'

type Mode = 'create' | 'edit' | 'duplicate'

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function checkAvailConflict(teacher: TeacherRow | undefined, date: string, start_time: string): boolean {
  if (!teacher?.availability?.length || !date || !start_time) return false
  try {
    const day = format(parseISO(date), 'EEEE')
    const slots = teacher.availability.filter(e => e.day === day)
    if (!slots.length) return true // not available this day at all
    // No conflict if session start falls within ANY of the teacher's slots for that day
    return !slots.some(e => toMin(start_time) >= toMin(e.start) && toMin(start_time) < toMin(e.end))
  } catch { return false }
}

interface Props {
  mode: Mode
  session?: SessionRow
  defaultClass?: ClassRow
  classes: ClassRow[]
  teachers: TeacherRow[]
  onClose: () => void
  onSaved: (session: SessionRow) => void
}

const STATUSES: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Upcoming / Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  outline: 'none',
}

export default function SessionFormModal({
  mode, session, defaultClass, classes, teachers, onClose, onSaved,
}: Props) {
  const isEdit = mode === 'edit'
  const title = mode === 'create' ? 'Add Session' : mode === 'edit' ? 'Edit Session' : 'Duplicate Session'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [savedIds, setSavedIds] = useState<string[] | null>(null)   // non-null = success state
  const [savedSession, setSavedSession] = useState<SessionRow | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)

  const [form, setForm] = useState({
    class_id:      session?.class_id ?? defaultClass?.id ?? '',
    subject_id:    session?.subject_id ?? '',
    teacher_id:    session?.teacher_id ?? '',
    date:          mode === 'duplicate' ? '' : (session?.date ?? ''),
    start_time:    session?.start_time?.slice(0, 5) ?? '',
    end_time:      session?.end_time?.slice(0, 5) ?? '',
    zoom_link:     session?.zoom_link ?? defaultClass?.zoom_link ?? '',
    student_count: session?.student_count?.toString() ?? '0',
    status:        (session?.status ?? 'scheduled') as SessionStatus,
    notes:         session?.notes ?? '',
    topic:         session?.topic ?? '',
    repeat_weekly: false,
    repeat_weeks:  '1',
  })

  // Day label
  const dayLabel = form.date
    ? format(parseISO(form.date), 'EEEE')
    : '—'

  // Availability conflict check
  const selectedTeacher = teachers.find(t => t.id === form.teacher_id)
  const availConflict = checkAvailConflict(selectedTeacher, form.date, form.start_time)

  // Schedule overlap check (DB query, debounced)
  const [scheduleConflict, setScheduleConflict] = useState(false)
  useEffect(() => {
    if (!form.teacher_id || !form.date || !form.start_time || !form.end_time) {
      setScheduleConflict(false); return
    }
    const tid = setTimeout(async () => {
      const { data } = await createClient()
        .from('sessions')
        .select('id')
        .eq('teacher_id', form.teacher_id)
        .eq('date', form.date)
        .lt('start_time', form.end_time)
        .gt('end_time', form.start_time)
      const conflicts = (data ?? []).filter((s: { id: string }) => s.id !== session?.id)
      setScheduleConflict(conflicts.length > 0)
    }, 300)
    return () => clearTimeout(tid)
  }, [form.teacher_id, form.date, form.start_time, form.end_time, session?.id])

  // Load subjects when class changes
  useEffect(() => {
    if (!form.class_id) { setSubjects([]); return }
    createClient()
      .from('subjects')
      .select('id, name, class_id, created_at')
      .eq('class_id', form.class_id)
      .order('name')
      .then(({ data }) => setSubjects((data ?? []) as SubjectRow[]))
  }, [form.class_id])

  // Pre-fill zoom link from class
  useEffect(() => {
    if (!form.class_id || isEdit) return
    const cls = classes.find(c => c.id === form.class_id)
    if (cls?.zoom_link) setForm(f => ({ ...f, zoom_link: cls!.zoom_link ?? '' }))
  }, [form.class_id])

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.class_id || !form.date || !form.start_time || !form.end_time) {
      setError('Class, date, and times are required.')
      return
    }
    setError('')
    setLoading(true)
    const supabase = createClient()

    const basePayload = {
      class_id:      form.class_id,
      subject_id:    form.subject_id || null,
      teacher_id:    form.teacher_id || null,
      start_time:    form.start_time,
      end_time:      form.end_time,
      zoom_link:     form.zoom_link.trim() || null,
      student_count: parseInt(form.student_count) || 0,
      status:        form.status,
      notes:         form.notes.trim() || null,
      topic:         form.topic.trim() || null,
    }

    if (isEdit && session) {
      const dateChanged = form.date !== session.date
      const payload = {
        ...basePayload,
        date: form.date,
        status: dateChanged && form.status === 'scheduled' ? 'rescheduled' : form.status,
      }
      const { data, error: err } = await supabase
        .from('sessions')
        .update(payload)
        .eq('id', session.id)
        .select('*, subjects(name), teachers(name), classes(name)')
        .single()
      setLoading(false)
      if (err) { setError(err.message); return }
      onSaved(data as SessionRow)   // edit: close immediately (no notify prompt)
    } else {
      // Create or duplicate — with optional weekly repeat
      const weeks = form.repeat_weekly ? parseInt(form.repeat_weeks) || 1 : 0
      const dates = [form.date]
      for (let i = 1; i <= weeks; i++) dates.push(format(addWeeks(parseISO(form.date), i), 'yyyy-MM-dd'))

      const payloads = dates.map(d => ({ ...basePayload, date: d }))
      const { data, error: err } = await supabase
        .from('sessions')
        .insert(payloads)
        .select('*, subjects(name), teachers(name), classes(name)')
      setLoading(false)
      if (err) { setError(err.message); return }
      const allSessions = data as SessionRow[]
      setSavedIds(allSessions.map(s => s.id))
      setSavedSession(allSessions[0])
      // If no teacher assigned, skip notify prompt entirely
      if (!form.teacher_id) {
        onSaved(allSessions[0])
      }
    }
  }

  async function handleNotify() {
    if (!savedIds) return
    setNotifying(true)
    await sendTeacherSessionEmail(savedIds)
    setNotifying(false)
    setNotified(true)
    setTimeout(() => { if (savedSession) onSaved(savedSession) }, 800)
  }

  function handleDone() {
    if (savedSession) onSaved(savedSession)
  }

  return (
    <Modal title={title} onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Class */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Program / Class <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select style={inputStyle} value={form.class_id} onChange={set('class_id')}>
              <option value="">Select class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Subject</label>
            <select style={inputStyle} value={form.subject_id} onChange={set('subject_id')} disabled={!form.class_id}>
              <option value="">Select subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Topic</label>
            <input style={inputStyle} type="text" value={form.topic} onChange={set('topic')} placeholder="e.g. Chapter 3 – Linear Equations" />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Date <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} type="date" value={form.date} onChange={set('date')} />
          </div>

          {/* Day (auto) */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Day</label>
            <div
              className="px-3 py-2 text-sm rounded-xl"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {dayLabel}
            </div>
          </div>

          {/* Start time */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Start Time <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} type="time" value={form.start_time} onChange={set('start_time')} />
          </div>

          {/* End time */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              End Time <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} type="time" value={form.end_time} onChange={set('end_time')} />
          </div>

          {/* Teacher */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Assigned Teacher</label>
            <select style={inputStyle} value={form.teacher_id} onChange={set('teacher_id')}>
              <option value="">Select teacher...</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {availConflict && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#D97706' }}>
                <AlertTriangle size={12} />
                Outside this teacher&apos;s set availability
              </p>
            )}
            {scheduleConflict && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={12} />
                Teacher already has a session at this date &amp; time
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
            <select style={inputStyle} value={form.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Zoom link */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Zoom Link</label>
            <input style={inputStyle} type="url" value={form.zoom_link} onChange={set('zoom_link')} placeholder="https://zoom.us/j/..." />
          </div>

          {/* Student count */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Student Count</label>
            <input style={inputStyle} type="number" min="0" value={form.student_count} onChange={set('student_count')} />
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Notes / Remarks</label>
            <textarea
              style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional notes..."
            />
          </div>

          {/* Repeat weekly (create/duplicate only) */}
          {!isEdit && (
            <div className="col-span-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.repeat_weekly}
                  onChange={e => setForm(f => ({ ...f, repeat_weekly: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Repeat weekly
                </span>
              </label>
              {form.repeat_weekly && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>for</span>
                  <input
                    style={{ ...inputStyle, width: '80px' }}
                    type="number"
                    min="1"
                    max="52"
                    value={form.repeat_weeks}
                    onChange={set('repeat_weeks')}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>additional weeks</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Success + notify state (create/duplicate only, with teacher assigned) */}
        {savedIds && form.teacher_id ? (
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-success)' }}>
              <CheckCircle2 size={16} />
              {savedIds.length === 1 ? 'Session saved!' : `${savedIds.length} sessions saved!`}
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'rgba(11,181,199,0.06)', border: '1px solid rgba(11,181,199,0.2)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Notify the assigned teacher by email?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-3 py-1.5 text-sm rounded-lg"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleNotify}
                  disabled={notifying || notified}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
                  style={{ backgroundColor: '#0BB5C7' }}
                >
                  {notifying ? <Loader2 size={13} className="animate-spin" /> : notified ? <CheckCircle2 size={13} /> : <Mail size={13} />}
                  {notified ? 'Sent!' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white flex items-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : mode === 'duplicate' ? 'Duplicate' : 'Add Session'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
