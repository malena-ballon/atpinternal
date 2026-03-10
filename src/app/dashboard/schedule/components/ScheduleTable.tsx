'use client'

import { useState, useRef } from 'react'
import { format, parseISO, isToday, isBefore, startOfDay, parse, isValid } from 'date-fns'
import { Pencil, Trash2, Loader2, Check, CalendarDays, Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow, SubjectRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
]

const STATUS_COLORS: Record<SessionStatus, { backgroundColor: string; color: string }> = {
  scheduled:   { backgroundColor: 'rgba(11,181,199,0.12)',  color: '#0BB5C7' },
  in_progress: { backgroundColor: 'rgba(217,119,6,0.12)',   color: '#D97706' },
  completed:   { backgroundColor: 'rgba(22,163,74,0.12)',   color: '#16A34A' },
  cancelled:   { backgroundColor: 'rgba(220,38,38,0.12)',   color: '#DC2626' },
  rescheduled: { backgroundColor: 'rgba(99,102,241,0.12)',  color: '#4F46E5' },
}

const BULK_STATUSES: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function autoStatus(date: string, start_time: string, end_time: string): SessionStatus {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'scheduled'
  const now = new Date()
  const d = parseISO(date)
  if (isBefore(d, startOfDay(now))) return 'completed'
  if (isToday(d)) {
    const sp = start_time?.split(':'), ep = end_time?.split(':')
    if (sp?.length >= 2 && ep?.length >= 2) {
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const sMin = parseInt(sp[0]) * 60 + parseInt(sp[1])
      const eMin = parseInt(ep[0]) * 60 + parseInt(ep[1])
      if (nowMin >= sMin && nowMin <= eMin) return 'in_progress'
      if (nowMin > eMin) return 'completed'
    }
    return 'scheduled'
  }
  return 'scheduled'
}

function parseDate(raw: string): string {
  if (!raw?.trim()) return ''
  raw = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  for (const fmt of ['MMMM d, yyyy', 'MMM d, yyyy', 'MMMM dd, yyyy', 'MMM dd, yyyy']) {
    const d = parse(raw, fmt, new Date())
    if (isValid(d)) return format(d, 'yyyy-MM-dd')
  }
  return ''
}

function parseTime(raw: string): string {
  if (!raw?.trim()) return ''
  raw = raw.trim()
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = ampm[2]
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    return `${h.toString().padStart(2, '0')}:${m}`
  }
  return ''
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── DraftRow ─────────────────────────────────────────────────────────────────

interface DraftRow {
  _key: string
  id?: string
  class_id: string
  date: string
  start_time: string
  end_time: string
  teacher_id: string
  subject_id: string
  topic: string
  status: SessionStatus
  student_count: number
  _statusLocked: boolean
  _isNew: boolean
  _dirty: boolean
}

let _keyCounter = 0
const newKey = () => `dr-${++_keyCounter}`

function sessionToRow(s: SessionRow): DraftRow {
  return {
    _key: s.id, id: s.id,
    class_id: s.class_id,
    date: s.date,
    start_time: s.start_time.slice(0, 5),
    end_time: s.end_time.slice(0, 5),
    teacher_id: s.teacher_id ?? '',
    subject_id: s.subject_id ?? '',
    topic: s.topic ?? '',
    status: s.status as SessionStatus,
    student_count: s.student_count ?? 0,
    _statusLocked: s.status === 'cancelled' || s.status === 'rescheduled',
    _isNew: false, _dirty: false,
  }
}

function blankRow(class_id = ''): DraftRow {
  return {
    _key: newKey(), class_id, date: '', start_time: '', end_time: '',
    teacher_id: '', subject_id: '', topic: '', status: 'scheduled',
    student_count: 0, _statusLocked: false, _isNew: true, _dirty: true,
  }
}

const cellInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  fontSize: '13px', color: 'var(--color-text-primary)', padding: '2px 0',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sessions: SessionRow[]
  selected: Set<string>
  onSelectToggle: (id: string) => void
  onSelectAll: () => void
  onBulkStatusChange: (ids: string[], status: SessionStatus) => void
  onSessionsChanged: (saved: SessionRow[]) => void
  classes: ClassRow[]
  teachers: TeacherRow[]
  subjectsByClass: Map<string, SubjectRow[]>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleTable({
  sessions, selected, onSelectToggle, onSelectAll,
  onBulkStatusChange, onSessionsChanged,
  classes, teachers, subjectsByClass,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const savedSnapshot = useRef<DraftRow[]>([])

  const allSelected = sessions.length > 0 && selected.size === sessions.length
  const dirtyCount = rows.filter(r => r._dirty).length + deletedIds.size

  function enterEditMode() {
    savedSnapshot.current = sessions.map(sessionToRow)
    setRows(sessions.map(sessionToRow))
    setDeletedIds(new Set())
    setSaveError('')
    setSaved(false)
    setEditMode(true)
  }

  function discardAndExit() {
    setRows([...savedSnapshot.current])
    setDeletedIds(new Set())
    setEditMode(false)
  }

  function updateRow(key: string, updates: Partial<DraftRow>) {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const next = { ...r, ...updates, _dirty: true }
      if (!next._statusLocked && (updates.date !== undefined || updates.start_time !== undefined || updates.end_time !== undefined))
        next.status = autoStatus(next.date, next.start_time, next.end_time)
      return next
    }))
  }

  function addRow() {
    // Default to first class if available
    const defaultClassId = classes[0]?.id ?? ''
    setRows(prev => [...prev, blankRow(defaultClassId)])
  }

  function removeRow(key: string, id?: string) {
    setRows(prev => prev.filter(r => r._key !== key))
    if (id) setDeletedIds(prev => new Set([...prev, id]))
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const toInsert = rows.filter(r => r._isNew && r.date && r.start_time && r.end_time)
    const toUpdate = rows.filter(r => !r._isNew && r._dirty && r.id)

    try {
      if (deletedIds.size > 0) {
        const { error } = await supabase.from('sessions').delete().in('id', Array.from(deletedIds))
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('sessions').insert(
          toInsert.map(r => ({
            class_id: r.class_id, date: r.date, start_time: r.start_time, end_time: r.end_time,
            teacher_id: r.teacher_id || null, subject_id: r.subject_id || null,
            topic: r.topic || null, status: r.status,
          }))
        )
        if (error) throw error
      }

      for (const r of toUpdate) {
        const { error } = await supabase.from('sessions').update({
          date: r.date, start_time: r.start_time, end_time: r.end_time,
          teacher_id: r.teacher_id || null, subject_id: r.subject_id || null,
          topic: r.topic || null, status: r.status,
        }).eq('id', r.id!)
        if (error) throw error
      }

      // Reload fresh data for changed/added rows
      const changedIds = toUpdate.map(r => r.id!)
      if (changedIds.length > 0) {
        const { data: fresh } = await supabase.from('sessions')
          .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, topic, class_id, subject_id, teacher_id, subjects(name), teachers(name), classes(name)')
          .in('id', changedIds)
        if (fresh) onSessionsChanged(fresh as unknown as SessionRow[])
      }

      // Reload all sessions if there were inserts or deletes
      if (toInsert.length > 0 || deletedIds.size > 0) {
        const { data: allFresh } = await supabase.from('sessions')
          .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, topic, class_id, subject_id, teacher_id, subjects(name), teachers(name), classes(name)')
          .order('date', { ascending: false }).order('start_time')
        if (allFresh) onSessionsChanged(allFresh as unknown as SessionRow[])
      }

      setDeletedIds(new Set())
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  function handleExportCSV() {
    const header = ['Date', 'Day', 'Time', 'Subject', 'Topic', 'Class', 'Teacher', 'Status', 'Students']
    const dataRows = sessions.map(s => [
      s.date ? format(parseISO(s.date), 'MMM d, yyyy') : '',
      s.date ? format(parseISO(s.date), 'EEE') : '',
      s.start_time && s.end_time ? `${fmt12(s.start_time)} – ${fmt12(s.end_time)}` : '',
      s.subjects?.name ?? '',
      s.topic ?? '',
      s.classes?.name ?? '',
      s.teachers?.name ?? '',
      STATUS_OPTIONS.find(o => o.value === s.status)?.label ?? s.status,
      s.student_count > 0 ? String(s.student_count) : '',
    ])
    downloadCSV('master-schedule.csv', [header, ...dataRows])
  }

  return (
    <div>
      {/* Toolbar (view mode) */}
      {!editMode && (
        <div className="flex items-center gap-2 mb-3">
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Export CSV
            </button>
            <button
              onClick={enterEditMode}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}>
              <Pencil size={13} /> Edit
            </button>
          </div>
        </div>
      )}

      {/* Toolbar (edit mode) */}
      {editMode && (
        <div className="flex items-center gap-2 mb-3">
          {dirtyCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={discardAndExit} className="px-4 py-1.5 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Exit
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
              style={{ backgroundColor: '#0BB5C7' }}>
              {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                : saved ? <><Check size={13} /> Saved!</>
                  : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Bulk action bar — view mode only */}
      {!editMode && selected.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3 text-sm"
          style={{ backgroundColor: 'rgba(61,212,230,0.08)', border: '1px solid rgba(61,212,230,0.2)' }}
        >
          <span className="font-medium" style={{ color: '#0BB5C7' }}>
            {selected.size} selected
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Set status:</span>
          <select
            className="text-sm rounded-lg px-2 py-1 outline-none"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            onChange={e => {
              if (e.target.value) {
                onBulkStatusChange(Array.from(selected), e.target.value as SessionStatus)
                e.target.value = ''
              }
            }}
          >
            <option value="">Choose status...</option>
            {BULK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            className="ml-auto text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => onSelectAll()}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      {saveError && (
        <div className="mb-3 text-sm p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
          {saveError}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-x-auto"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {!editMode ? (
          // ── VIEW MODE ──────────────────────────────────────────────────────
          sessions.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No sessions match your filters.
            </p>
          ) : (
            <table className="w-full" style={{ minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onSelectAll}
                      className="rounded"
                      style={{ accentColor: '#0BB5C7' }}
                    />
                  </th>
                  {['Date', 'Day', 'Time', 'Subject', 'Topic', 'Class', 'Teacher', 'Status', 'Students'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: selected.has(s.id) ? 'rgba(61,212,230,0.03)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => onSelectToggle(s.id)}
                        className="rounded"
                        style={{ accentColor: '#0BB5C7' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {format(parseISO(s.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {format(parseISO(s.date), 'EEE')}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {fmt12(s.start_time)} – {fmt12(s.end_time)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {s.subjects?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {s.topic ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {s.classes?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {s.teachers?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status as SessionStatus} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                      {s.student_count > 0 ? s.student_count : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          // ── EDIT MODE ──────────────────────────────────────────────────────
          <table className="w-full" style={{ minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {['#', 'Date', 'Day', 'Start', 'End', 'Class', 'Teacher', 'Subject', 'Topic', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No rows. Click &quot;Add row&quot; to begin.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const rowSubjects = subjectsByClass.get(row.class_id) ?? []
                return (
                  <tr key={row._key} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--color-text-muted)', width: '36px' }}>{i + 1}</td>

                    {/* Date */}
                    <td className="px-2 py-1.5" style={{ minWidth: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="text"
                          value={row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date}
                          placeholder="M/D/YYYY"
                          onChange={e => { const p = parseDate(e.target.value); updateRow(row._key, { date: p || e.target.value }) }}
                          onBlur={e => { const p = parseDate(e.target.value); if (p) updateRow(row._key, { date: p }) }}
                          style={{ ...cellInput, flex: 1, minWidth: 0 }} />
                        <label style={{ cursor: 'pointer', lineHeight: 0, flexShrink: 0, position: 'relative' }}>
                          <input type="date" value={row.date} onChange={e => updateRow(row._key, { date: e.target.value })}
                            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }} tabIndex={-1} />
                          <CalendarDays size={13} style={{ color: 'var(--color-text-muted)', display: 'block' }}
                            onClick={e => {
                              const inp = (e.currentTarget as unknown as HTMLElement).closest('label')?.querySelector('input[type="date"]') as HTMLInputElement | null
                              inp?.showPicker?.()
                            }} />
                        </label>
                      </div>
                    </td>

                    {/* Day (auto) */}
                    <td className="px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-muted)', minWidth: '48px' }}>
                      {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'EEE') : '—'}
                    </td>

                    {/* Start */}
                    <td className="px-2 py-1.5" style={{ minWidth: '110px' }}>
                      <input type="time" value={row.start_time}
                        onChange={e => updateRow(row._key, { start_time: e.target.value })}
                        style={cellInput} />
                    </td>

                    {/* End */}
                    <td className="px-2 py-1.5" style={{ minWidth: '110px' }}>
                      <input type="time" value={row.end_time}
                        onChange={e => updateRow(row._key, { end_time: e.target.value })}
                        style={cellInput} />
                    </td>

                    {/* Class (read-only label for existing, dropdown for new) */}
                    <td className="px-2 py-1.5" style={{ minWidth: '150px' }}>
                      {row._isNew ? (
                        <select value={row.class_id}
                          onChange={e => updateRow(row._key, { class_id: e.target.value, subject_id: '' })}
                          style={{ ...cellInput, cursor: 'pointer' }}>
                          <option value="">— Class —</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {classes.find(c => c.id === row.class_id)?.name ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Teacher */}
                    <td className="px-2 py-1.5" style={{ minWidth: '150px' }}>
                      <select value={row.teacher_id}
                        onChange={e => updateRow(row._key, { teacher_id: e.target.value })}
                        style={{ ...cellInput, cursor: 'pointer' }}>
                        <option value="">— Teacher —</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>

                    {/* Subject (filtered by class) */}
                    <td className="px-2 py-1.5" style={{ minWidth: '150px' }}>
                      <select value={row.subject_id}
                        onChange={e => updateRow(row._key, { subject_id: e.target.value })}
                        style={{ ...cellInput, cursor: 'pointer' }}>
                        <option value="">— Subject —</option>
                        {rowSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>

                    {/* Topic */}
                    <td className="px-2 py-1.5" style={{ minWidth: '160px' }}>
                      <input type="text" value={row.topic} placeholder="Topic…"
                        onChange={e => updateRow(row._key, { topic: e.target.value })}
                        style={cellInput} />
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5" style={{ minWidth: '130px' }}>
                      <select value={row.status}
                        onChange={e => { const v = e.target.value as SessionStatus; updateRow(row._key, { status: v, _statusLocked: true }) }}
                        className="text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ border: 'none', outline: 'none', cursor: 'pointer', ...STATUS_COLORS[row.status] }}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-1.5" style={{ width: '40px' }}>
                      <button onClick={() => removeRow(row._key, row.id)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: 'var(--color-danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editMode && (
        <button onClick={addRow} className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: '#0BB5C7' }}>
          <Plus size={14} /> Add row
        </button>
      )}
    </div>
  )
}
