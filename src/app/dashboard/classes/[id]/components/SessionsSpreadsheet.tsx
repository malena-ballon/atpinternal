'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO, isToday, isBefore, startOfDay, parse, isValid } from 'date-fns'
import { Plus, Trash2, Loader2, Check, CalendarDays, AlertTriangle, Pencil } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, SessionStatus, SubjectRow, TeacherRow } from '@/types'

// ─── Availability conflict helper ─────────────────────────────────────────────
function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function checkAvailConflict(teacher: TeacherRow | undefined, date: string, start_time: string): boolean {
  if (!teacher?.availability?.length || !date || !start_time) return false
  try {
    const day = format(parseISO(date), 'EEEE')
    const slots = teacher.availability.filter(e => e.day === day)
    if (!slots.length) return true
    return !slots.some(e => toMin(start_time) >= toMin(e.start) && toMin(start_time) < toMin(e.end))
  } catch { return false }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftRow {
  _key: string
  id?: string
  date: string
  start_time: string
  end_time: string
  teacher_id: string
  subject_id: string
  status: SessionStatus
  _statusLocked: boolean
  _isNew: boolean
  _dirty: boolean
}

interface Sel { r1: number; r2: number; c1: number; c2: number }

interface Props {
  classId: string
  initialSessions: SessionRow[]
  subjects: SubjectRow[]
  teachers: TeacherRow[]
  initialStudentCount: number
}

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

function fmt12(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// editable columns: 0=date,1=start,2=end,3=teacher,4=subject
type PasteCol = 'date' | 'start_time' | 'end_time' | 'teacher_id' | 'subject_id'
const PASTE_COLS: PasteCol[] = ['date', 'start_time', 'end_time', 'teacher_id', 'subject_id']

const cellInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  fontSize: '13px', color: 'var(--color-text-primary)', padding: '2px 0',
}

let _keyCounter = 0
const newKey = () => `new-${++_keyCounter}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
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
    return `${h.padStart(2,'0')}:${m}`
  }
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = ampm[2]
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    return `${h.toString().padStart(2,'0')}:${m}`
  }
  return ''
}

function sessionToRow(s: SessionRow): DraftRow {
  return {
    _key: s.id, id: s.id,
    date: s.date,
    start_time: s.start_time.slice(0,5),
    end_time: s.end_time.slice(0,5),
    teacher_id: s.teacher_id ?? '',
    subject_id: s.subject_id ?? '',
    status: s.status as SessionStatus,
    _statusLocked: s.status === 'cancelled' || s.status === 'rescheduled',
    _isNew: false, _dirty: false,
  }
}

function blankRow(): DraftRow {
  return { _key: newKey(), date: '', start_time: '', end_time: '', teacher_id: '', subject_id: '',
    status: 'scheduled', _statusLocked: false, _isNew: true, _dirty: true }
}

function getCellText(row: DraftRow, c: number, teachers: TeacherRow[], subjects: SubjectRow[]): string {
  if (c === 0) return row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date
  if (c === 1) return row.start_time
  if (c === 2) return row.end_time
  if (c === 3) return teachers.find(t => t.id === row.teacher_id)?.name ?? ''
  if (c === 4) return subjects.find(s => s.id === row.subject_id)?.name ?? ''
  return ''
}

function applyCellValue(row: DraftRow, c: number, raw: string, teachers: TeacherRow[], subjects: SubjectRow[]) {
  const col = PASTE_COLS[c]
  if (!col) return
  if (col === 'date') { row.date = parseDate(raw) || row.date }
  else if (col === 'start_time') { row.start_time = parseTime(raw) || row.start_time }
  else if (col === 'end_time')   { row.end_time   = parseTime(raw) || row.end_time }
  else if (col === 'teacher_id') { const m = teachers.find(t => t.name.toLowerCase() === raw.toLowerCase()); if (m) row.teacher_id = m.id }
  else if (col === 'subject_id') { const m = subjects.find(s => s.name.toLowerCase() === raw.toLowerCase()); if (m) row.subject_id = m.id }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionsSpreadsheet({ classId, initialSessions, subjects, teachers, initialStudentCount }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    [...initialSessions]
      .sort((a,b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .map(sessionToRow)
  )
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [studentCount, setStudentCount] = useState(initialStudentCount.toString())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const savedSnapshot = useRef<DraftRow[]>([])
  const editModeRef = useRef(false)

  // Cell selection
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)

  // Leave warning
  const [showLeaveWarning, setShowLeaveWarning] = useState(false)
  const pendingNavRef = useRef<(() => void) | null>(null)
  const dirtyRef = useRef(0)

  const dirtyCount = rows.filter(r => r._dirty).length + deletedIds.size

  // Keep refs up to date
  useEffect(() => { dirtyRef.current = dirtyCount }, [dirtyCount])
  useEffect(() => { editModeRef.current = editMode }, [editMode])

  function enterEditMode() {
    savedSnapshot.current = rows.map(r => ({ ...r }))
    setSel(null)
    setSaved(false)
    setSaveError('')
    setEditMode(true)
  }

  function handleExit() {
    if (dirtyCount > 0) setShowExitConfirm(true)
    else setEditMode(false)
  }

  function discardAndExit() {
    setRows([...savedSnapshot.current])
    setDeletedIds(new Set())
    setEditMode(false)
    setShowExitConfirm(false)
  }

  // Intercept Next.js client-side navigation when dirty and in edit mode
  useEffect(() => {
    const original = window.history.pushState.bind(window.history)
    window.history.pushState = function (...args) {
      if (editModeRef.current && dirtyRef.current > 0) {
        pendingNavRef.current = () => original(...args)
        setTimeout(() => setShowLeaveWarning(true), 0)
      } else {
        original(...args)
      }
    }
    return () => { window.history.pushState = original }
  }, [])

  // Browser close/refresh warning — only in edit mode with dirty changes
  useEffect(() => {
    if (!editMode || !dirtyCount) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); return (e.returnValue = '') }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editMode, dirtyCount])

  // Ctrl+C: copy selected cells | Ctrl+V: range-paste when multi-cell selection — only in edit mode
  useEffect(() => {
    if (!editMode) return
    const handle = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !sel) return
      const [r1, r2] = [Math.min(sel.r1,sel.r2), Math.max(sel.r1,sel.r2)]
      const [c1, c2] = [Math.min(sel.c1,sel.c2), Math.max(sel.c1,sel.c2)]

      if (e.key === 'c') {
        // Skip if input has text selection
        const el = document.activeElement
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart !== el.selectionEnd) return
        e.preventDefault()
        const text = rows.slice(r1, r2+1)
          .map(row => Array.from({length: c2-c1+1}, (_,i) => getCellText(row, c1+i, teachers, subjects)).join('\t'))
          .join('\n')
        navigator.clipboard.writeText(text)
      }

      if (e.key === 'v') {
        const selSize = (r2-r1+1) * (c2-c1+1)
        if (selSize <= 1) return // single cell: let onPaste handle
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text) return
          const pastedRows = text.trim().split('\n').filter(Boolean)
          setRows(prev => {
            const next = [...prev]
            if (pastedRows.length === 1 && !pastedRows[0].includes('\t')) {
              // Fill entire selection with one value
              const raw = pastedRows[0].trim()
              for (let r = r1; r <= r2; r++) {
                if (!next[r]) continue
                const row = { ...next[r], _dirty: true }
                for (let c = c1; c <= c2; c++) applyCellValue(row, c, raw, teachers, subjects)
                if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
                next[r] = row
              }
            } else {
              for (let ri = 0; ri < pastedRows.length && (r1+ri) <= r2; ri++) {
                const cols = pastedRows[ri].split('\t')
                const row = { ...next[r1+ri], _dirty: true }
                for (let ci = 0; ci < cols.length && (c1+ci) <= c2; ci++)
                  applyCellValue(row, c1+ci, cols[ci].trim(), teachers, subjects)
                if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
                next[r1+ri] = row
              }
            }
            return next
          })
        })
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [editMode, sel, rows, teachers, subjects])

  function cellMouseDown(r: number, c: number, e: React.MouseEvent) {
    if (e.shiftKey && anchorRef.current) {
      setSel({ r1: anchorRef.current.r, r2: r, c1: anchorRef.current.c, c2: c })
    } else {
      anchorRef.current = { r, c }
      setSel({ r1: r, r2: r, c1: c, c2: c })
    }
  }

  function inSel(r: number, c: number) {
    if (!sel) return false
    return r >= Math.min(sel.r1,sel.r2) && r <= Math.max(sel.r1,sel.r2)
      && c >= Math.min(sel.c1,sel.c2) && c <= Math.max(sel.c1,sel.c2)
  }

  // Check if row i has a schedule overlap with any other row in this spreadsheet
  function rowHasScheduleConflict(i: number): boolean {
    const row = rows[i]
    if (!row.teacher_id || !row.date || !row.start_time || !row.end_time) return false
    return rows.some((other, j) => {
      if (j === i || !other.teacher_id || other.teacher_id !== row.teacher_id) return false
      if (other.date !== row.date || !other.start_time || !other.end_time) return false
      return row.start_time < other.end_time && other.start_time < row.end_time
    })
  }

  function addRow() {
    setRows(prev => [...prev, blankRow()])
  }

  function removeRow(key: string, id?: string) {
    setRows(prev => prev.filter(r => r._key !== key))
    if (id) setDeletedIds(prev => new Set([...prev, id]))
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

  function handleCellPaste(e: React.ClipboardEvent, rowKey: string, startCol: number) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return
    const pastedRows = text.trim().split('\n').filter(Boolean)
    setRows(prev => {
      const next = [...prev]
      const rowIdx = next.findIndex(r => r._key === rowKey)
      if (rowIdx === -1) return prev
      for (let ri = 0; ri < pastedRows.length; ri++) {
        const ti = rowIdx + ri
        while (next.length <= ti) next.push(blankRow())
        const cols = pastedRows[ri].split('\t')
        const row = { ...next[ti], _dirty: true }
        for (let ci = 0; ci < cols.length; ci++) {
          if (startCol + ci >= PASTE_COLS.length) break
          applyCellValue(row, startCol + ci, cols[ci].trim(), teachers, subjects)
        }
        if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
        next[ti] = row
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const sc = parseInt(studentCount) || 0
    const toInsert = rows.filter(r => r._isNew && r.date && r.start_time && r.end_time)
    const toUpdate = rows.filter(r => !r._isNew && r._dirty && r.id)
    try {
      if (deletedIds.size > 0) {
        const { error } = await supabase.from('sessions').delete().in('id', Array.from(deletedIds))
        if (error) throw error
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('sessions').insert(
          toInsert.map(r => ({ class_id: classId, date: r.date, start_time: r.start_time, end_time: r.end_time,
            teacher_id: r.teacher_id || null, subject_id: r.subject_id || null, status: r.status, student_count: sc }))
        )
        if (error) throw error
      }
      for (const r of toUpdate) {
        const { error } = await supabase.from('sessions').update({
          date: r.date, start_time: r.start_time, end_time: r.end_time,
          teacher_id: r.teacher_id || null, subject_id: r.subject_id || null, status: r.status, student_count: sc,
        }).eq('id', r.id!)
        if (error) throw error
      }
      if (rows.some(r => !r._isNew))
        await supabase.from('sessions').update({ student_count: sc }).eq('class_id', classId)
      const { data: fresh } = await supabase.from('sessions')
        .select('id, date, start_time, end_time, status, student_count, zoom_link, notes, class_id, subject_id, teacher_id, subjects(name), teachers(name), classes(name)')
        .eq('class_id', classId).order('date').order('start_time')
      if (fresh) setRows((fresh as unknown as SessionRow[]).map(sessionToRow))
      setDeletedIds(new Set())
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  // Cell style helper
  function cellStyle(r: number, c: number, row: DraftRow): React.CSSProperties {
    const selected = inSel(r, c)
    return {
      backgroundColor: selected ? 'rgba(11,181,199,0.1)' : row._dirty ? 'rgba(61,212,230,0.02)' : 'transparent',
      boxShadow: selected ? 'inset 0 0 0 1px rgba(11,181,199,0.45)' : 'none',
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Students enrolled:</label>
          <input type="number" min="0" value={studentCount} onChange={e => setStudentCount(e.target.value)}
            className="w-20 text-sm text-center rounded-lg px-2 py-1.5 outline-none"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!editMode && (
            <button onClick={enterEditMode}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}>
              <Pencil size={13} /> Edit
            </button>
          )}
          {editMode && (
            <>
              {dirtyCount > 0 && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}</span>}
              <button onClick={handleExit} className="px-4 py-1.5 text-sm rounded-xl"
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
            </>
          )}
        </div>
      </div>

      {editMode && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy · Ctrl/Cmd+V to paste
        </p>
      )}

      {saveError && (
        <div className="mb-3 text-sm p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
          {saveError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full" style={{ minWidth: '820px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              {['#','Date','Day','Start','End','Teacher','Subject','Status',''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No sessions yet.</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={row._key} style={{ borderBottom: i < rows.length-1 ? '1px solid var(--color-border)' : 'none' }}>
                <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--color-text-muted)', width: '36px' }}>{i+1}</td>

                {!editMode ? (
                  // ── View mode ──────────────────────────────────────────────────
                  <>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'EEE') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{fmt12(row.start_time)}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{fmt12(row.end_time)}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {teachers.find(t => t.id === row.teacher_id)?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {subjects.find(s => s.id === row.subject_id)?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={STATUS_COLORS[row.status]}>
                        {STATUS_OPTIONS.find(o => o.value === row.status)?.label}
                      </span>
                    </td>
                    <td />
                  </>
                ) : (
                  // ── Edit mode ──────────────────────────────────────────────────
                  <>
                    {/* Date col=0 */}
                    <td className="px-2 py-1.5" style={{ minWidth: '160px', ...cellStyle(i,0,row) }} onMouseDown={e => cellMouseDown(i,0,e)}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <input type="text"
                          value={row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date),'M/d/yyyy') : row.date}
                          placeholder="M/D/YYYY"
                          onChange={e => { const p = parseDate(e.target.value); updateRow(row._key, { date: p || e.target.value }) }}
                          onBlur={e => { const p = parseDate(e.target.value); if (p) updateRow(row._key, { date: p }) }}
                          onPaste={e => handleCellPaste(e, row._key, 0)}
                          style={{ ...cellInput, flex:1, minWidth:0 }} />
                        <label style={{ cursor:'pointer', lineHeight:0, flexShrink:0, position:'relative' }}>
                          <input type="date" value={row.date} onChange={e => updateRow(row._key, { date: e.target.value })}
                            style={{ position:'absolute', opacity:0, width:'1px', height:'1px', pointerEvents:'none' }} tabIndex={-1} />
                          <CalendarDays size={13} style={{ color:'var(--color-text-muted)', display:'block' }}
                            onClick={e => {
                              const inp = (e.currentTarget as unknown as HTMLElement).closest('label')?.querySelector('input[type="date"]') as HTMLInputElement|null
                              inp?.showPicker?.()
                            }} />
                        </label>
                      </div>
                    </td>

                    {/* Day (auto) */}
                    <td className="px-2 py-1.5 text-xs" style={{ color:'var(--color-text-muted)', minWidth:'48px' }}>
                      {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date),'EEE') : '—'}
                    </td>

                    {/* Start col=1 */}
                    <td className="px-2 py-1.5" style={{ minWidth:'110px', ...cellStyle(i,1,row) }} onMouseDown={e => cellMouseDown(i,1,e)}>
                      <input type="time" value={row.start_time} onChange={e => updateRow(row._key,{start_time:e.target.value})}
                        onPaste={e => handleCellPaste(e,row._key,1)} style={cellInput} />
                    </td>

                    {/* End col=2 */}
                    <td className="px-2 py-1.5" style={{ minWidth:'110px', ...cellStyle(i,2,row) }} onMouseDown={e => cellMouseDown(i,2,e)}>
                      <input type="time" value={row.end_time} onChange={e => updateRow(row._key,{end_time:e.target.value})}
                        onPaste={e => handleCellPaste(e,row._key,2)} style={cellInput} />
                    </td>

                    {/* Teacher col=3 */}
                    <td className="px-2 py-1.5" style={{ minWidth:'165px', ...cellStyle(i,3,row) }} onMouseDown={e => cellMouseDown(i,3,e)}
                      onPaste={e => handleCellPaste(e,row._key,3)}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <select value={row.teacher_id} onChange={e => updateRow(row._key,{teacher_id:e.target.value})}
                          style={{ ...cellInput, cursor:'pointer', flex:1 }}>
                          <option value="">— Teacher —</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {checkAvailConflict(teachers.find(t => t.id === row.teacher_id), row.date, row.start_time) && (
                          <span title="Outside teacher's availability" style={{ flexShrink:0, lineHeight:0 }}><AlertTriangle size={13} style={{ color:'#D97706' }} /></span>
                        )}
                        {rowHasScheduleConflict(i) && (
                          <span title="Teacher already has an overlapping session" style={{ flexShrink:0, lineHeight:0 }}><AlertTriangle size={13} style={{ color:'var(--color-danger)' }} /></span>
                        )}
                      </div>
                    </td>

                    {/* Subject col=4 */}
                    <td className="px-2 py-1.5" style={{ minWidth:'150px', ...cellStyle(i,4,row) }} onMouseDown={e => cellMouseDown(i,4,e)}
                      onPaste={e => handleCellPaste(e,row._key,4)}>
                      <select value={row.subject_id} onChange={e => updateRow(row._key,{subject_id:e.target.value})}
                        style={{ ...cellInput, cursor:'pointer' }}>
                        <option value="">— Subject —</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5" style={{ minWidth:'130px' }}>
                      <select value={row.status}
                        onChange={e => { const v = e.target.value as SessionStatus; updateRow(row._key,{status:v,_statusLocked:true}) }}
                        className="text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ border:'none', outline:'none', cursor:'pointer', ...STATUS_COLORS[row.status] }}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-1.5" style={{ width:'40px' }}>
                      <button onClick={() => removeRow(row._key, row.id)} className="w-6 h-6 flex items-center justify-center rounded" style={{ color:'var(--color-danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editMode && (
        <button onClick={addRow} className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color:'#0BB5C7' }}>
          <Plus size={14} /> Add row
        </button>
      )}

      {/* Exit without saving confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor:'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor:'var(--color-surface)', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 className="text-base font-semibold" style={{ color:'var(--color-text-primary)' }}>Discard changes?</h3>
            <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
              You have {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}. They will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="px-4 py-2 text-sm rounded-xl"
                style={{ border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
                Keep editing
              </button>
              <button onClick={discardAndExit} className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor:'var(--color-danger)' }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes leave warning */}
      {showLeaveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor:'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor:'var(--color-surface)', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 className="text-base font-semibold" style={{ color:'var(--color-text-primary)' }}>Unsaved changes</h3>
            <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
              You have {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}. Are you sure you want to leave without saving?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLeaveWarning(false)} className="px-4 py-2 text-sm rounded-xl"
                style={{ border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
                Stay
              </button>
              <button onClick={() => { setShowLeaveWarning(false); pendingNavRef.current?.(); pendingNavRef.current = null }}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor:'var(--color-danger)' }}>
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
