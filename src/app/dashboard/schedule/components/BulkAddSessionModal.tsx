'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO, isToday, isBefore, startOfDay, parse, isValid } from 'date-fns'
import { Plus, Trash2, Loader2, CalendarDays, AlertTriangle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow, SubjectRow } from '@/types'

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
  date: string
  start_time: string
  end_time: string
  teacher_id: string
  subject_id: string
  status: SessionStatus
  _statusLocked: boolean
}

interface Props {
  classes: ClassRow[]
  teachers: TeacherRow[]
  onClose: () => void
  onSaved: (sessions: SessionRow[]) => void
}

interface Sel { r1: number; r2: number; c1: number; c2: number }

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

// Column indices: 0=date, 1=start_time, 2=end_time, 3=teacher_id, 4=subject_id, 5=status
const COL_COUNT = 6

const cellInput: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  padding: '2px 0',
}

let _keyCounter = 0
const newKey = () => `r-${++_keyCounter}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoStatus(date: string, start_time: string, end_time: string): SessionStatus {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'scheduled'
  const now = new Date()
  const sessionDate = parseISO(date)
  if (isBefore(sessionDate, startOfDay(now))) return 'completed'
  if (isToday(sessionDate)) {
    const sp = start_time?.split(':')
    const ep = end_time?.split(':')
    if (sp?.length >= 2 && ep?.length >= 2) {
      const nowMin   = now.getHours() * 60 + now.getMinutes()
      const startMin = parseInt(sp[0]) * 60 + parseInt(sp[1])
      const endMin   = parseInt(ep[0]) * 60 + parseInt(ep[1])
      if (nowMin >= startMin && nowMin <= endMin) return 'in_progress'
      if (nowMin > endMin) return 'completed'
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

function emptyRow(): DraftRow {
  return { _key: newKey(), date: '', start_time: '', end_time: '', teacher_id: '', subject_id: '', status: 'scheduled', _statusLocked: false }
}

function getCellText(row: DraftRow, c: number, teachers: TeacherRow[], subjects: SubjectRow[]): string {
  if (c === 0) return row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date
  if (c === 1) return row.start_time
  if (c === 2) return row.end_time
  if (c === 3) return teachers.find(t => t.id === row.teacher_id)?.name ?? ''
  if (c === 4) return subjects.find(s => s.id === row.subject_id)?.name ?? ''
  if (c === 5) return STATUS_OPTIONS.find(o => o.value === row.status)?.label ?? row.status
  return ''
}

function applyCellValue(row: DraftRow, c: number, raw: string, teachers: TeacherRow[], subjects: SubjectRow[]): Partial<DraftRow> {
  if (c === 0) { const d = parseDate(raw); return d ? { date: d } : {} }
  if (c === 1) { const t = parseTime(raw); return t ? { start_time: t } : {} }
  if (c === 2) { const t = parseTime(raw); return t ? { end_time: t } : {} }
  if (c === 3) {
    const match = teachers.find(t => t.name.toLowerCase() === raw.toLowerCase())
    return match ? { teacher_id: match.id } : {}
  }
  if (c === 4) {
    const match = subjects.find(s => s.name.toLowerCase() === raw.toLowerCase())
    return match ? { subject_id: match.id } : {}
  }
  if (c === 5) {
    const match = STATUS_OPTIONS.find(o => o.label.toLowerCase() === raw.toLowerCase() || o.value === raw.toLowerCase())
    return match ? { status: match.value, _statusLocked: true } : {}
  }
  return {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkAddSessionModal({ classes, teachers, onClose, onSaved }: Props) {
  const [selectedClassId, setSelectedClassId] = useState('')
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(), emptyRow(), emptyRow()])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sel, setSel] = useState<Sel | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)

  useEffect(() => {
    if (!selectedClassId) { setSubjects([]); return }
    createClient()
      .from('subjects').select('id, name, class_id, created_at')
      .eq('class_id', selectedClassId).order('name')
      .then(({ data }) => setSubjects((data ?? []) as SubjectRow[]))
  }, [selectedClassId])

  // Global Ctrl+C / Ctrl+V for multi-cell selection
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !sel) return
      const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
      const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)

      if (e.key === 'c') {
        const el = document.activeElement
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart !== el.selectionEnd) return
        e.preventDefault()
        const text = rows.slice(r1, r2 + 1)
          .map(row => Array.from({ length: c2 - c1 + 1 }, (_, i) => getCellText(row, c1 + i, teachers, subjects)).join('\t'))
          .join('\n')
        navigator.clipboard.writeText(text)
      }

      if (e.key === 'v') {
        const selSize = (r2 - r1 + 1) * (c2 - c1 + 1)
        if (selSize <= 1) return
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text.trim()) return
          const pastedRows = text.trim().split('\n').map(r => r.split('\t'))
          setRows(prev => {
            const next = [...prev]
            for (let ri = r1; ri <= r2; ri++) {
              const pRow = pastedRows.length === 1 ? pastedRows[0] : pastedRows[ri - r1] ?? []
              const row = { ...next[ri] }
              for (let ci = c1; ci <= c2; ci++) {
                const pVal = pRow.length === 1 ? pRow[0] : pRow[ci - c1] ?? ''
                Object.assign(row, applyCellValue(row, ci, pVal.trim(), teachers, subjects))
              }
              if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
              next[ri] = row
            }
            return next
          })
        })
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [sel, rows, teachers, subjects])

  function cellMouseDown(r: number, c: number, e: React.MouseEvent) {
    if (e.shiftKey && anchorRef.current) {
      setSel({ r1: anchorRef.current.r, c1: anchorRef.current.c, r2: r, c2: c })
    } else {
      anchorRef.current = { r, c }
      setSel({ r1: r, c1: c, r2: r, c2: c })
    }
  }

  function inSel(r: number, c: number): boolean {
    if (!sel) return false
    const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
    const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)
    return r >= r1 && r <= r2 && c >= c1 && c <= c2
  }

  function cellTdStyle(r: number, c: number, base?: React.CSSProperties): React.CSSProperties {
    return inSel(r, c)
      ? { ...base, backgroundColor: 'rgba(11,181,199,0.10)', boxShadow: 'inset 0 0 0 1px rgba(11,181,199,0.5)' }
      : { ...base }
  }

  function addRow() { setRows(prev => [...prev, emptyRow()]) }
  function removeRow(key: string) { setRows(prev => prev.filter(r => r._key !== key)) }

  function updateRow(key: string, updates: Partial<DraftRow>) {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const next = { ...r, ...updates }
      if (!next._statusLocked && (updates.date !== undefined || updates.start_time !== undefined || updates.end_time !== undefined)) {
        next.status = autoStatus(next.date, next.start_time, next.end_time)
      }
      return next
    }))
  }

  // Cell-level paste: fills from (rowKey, startColIdx) across cols and down rows
  function handleCellPaste(e: React.ClipboardEvent, rowKey: string, startColIdx: number) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return
    const pastedRows = text.trim().split('\n').filter(Boolean)
    setRows(prev => {
      const next = [...prev]
      const rowIdx = next.findIndex(r => r._key === rowKey)
      if (rowIdx === -1) return prev
      for (let ri = 0; ri < pastedRows.length; ri++) {
        const targetIdx = rowIdx + ri
        while (next.length <= targetIdx) next.push(emptyRow())
        const cols = pastedRows[ri].split('\t')
        const row = { ...next[targetIdx] }
        for (let ci = 0; ci < cols.length; ci++) {
          const colIdx = startColIdx + ci
          if (colIdx >= COL_COUNT) break
          Object.assign(row, applyCellValue(row, colIdx, cols[ci].trim(), teachers, subjects))
        }
        if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
        next[targetIdx] = row
      }
      return next
    })
  }

  function hasDirtyRows(): boolean {
    return rows.some(r => r.date || r.start_time || r.end_time || r.teacher_id || r.subject_id)
  }

  // Check if row i has a schedule overlap with any other row in this modal
  function rowHasScheduleConflict(i: number): boolean {
    const row = rows[i]
    if (!row.teacher_id || !row.date || !row.start_time || !row.end_time) return false
    return rows.some((other, j) => {
      if (j === i || !other.teacher_id || other.teacher_id !== row.teacher_id) return false
      if (other.date !== row.date || !other.start_time || !other.end_time) return false
      return row.start_time < other.end_time && other.start_time < row.end_time
    })
  }

  function handleClose() {
    if (hasDirtyRows()) { setShowCloseConfirm(true) } else { onClose() }
  }

  async function handleSave() {
    if (!selectedClassId) { setSaveError('Please select a class first.'); return }
    const valid = rows.filter(r => r.date && r.start_time && r.end_time)
    if (valid.length === 0) { setSaveError('Add at least one row with date and times.'); return }
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sessions')
      .insert(valid.map(r => ({
        class_id: selectedClassId,
        date: r.date, start_time: r.start_time, end_time: r.end_time,
        teacher_id: r.teacher_id || null,
        subject_id: r.subject_id || null,
        status: r.status,
      })))
      .select('*, subjects(name), teachers(name), classes(name)')
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    onSaved((data ?? []) as SessionRow[])
  }

  return (
    <>
      <Modal title="Add Sessions" onClose={handleClose} width="2xl">
        <div className="space-y-4">
          {/* Class selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              Program / Class <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Select a class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Hint */}
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy · Ctrl/Cmd+V to paste · Click any cell and paste to fill from that position.{' '}
            Column order: <strong style={{ color: 'var(--color-text-secondary)' }}>Date · Start · End · Teacher · Subject · Status</strong>
          </p>

          {saveError && (
            <div className="text-sm p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              {saveError}
            </div>
          )}

          {/* Table */}
          <div
            className="rounded-xl overflow-x-auto"
            style={{ border: '1px solid var(--color-border)', maxHeight: '400px', overflowY: 'auto' }}
            onMouseDown={() => {/* allow propagation for cell selection */}}
          >
            <table className="w-full" style={{ minWidth: '820px', userSelect: 'none' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['#', 'Date', 'Day', 'Start', 'End', 'Teacher', 'Subject', 'Status', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row._key} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--color-text-muted)', width: '36px' }}>{i + 1}</td>

                    {/* Date — col 0 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 0, { minWidth: '160px' })}
                      onMouseDown={e => cellMouseDown(i, 0, e)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          value={row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date}
                          placeholder="M/D/YYYY"
                          onChange={e => {
                            const parsed = parseDate(e.target.value)
                            updateRow(row._key, { date: parsed || e.target.value })
                          }}
                          onBlur={e => {
                            const parsed = parseDate(e.target.value)
                            if (parsed) updateRow(row._key, { date: parsed })
                          }}
                          onPaste={e => handleCellPaste(e, row._key, 0)}
                          style={{ ...cellInput, flex: 1, minWidth: 0, userSelect: 'text' }}
                        />
                        <label style={{ cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}>
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateRow(row._key, { date: e.target.value })}
                            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
                            tabIndex={-1}
                          />
                          <CalendarDays
                            size={13}
                            style={{ color: 'var(--color-text-muted)', display: 'block' }}
                            onClick={e => {
                              const label = (e.currentTarget as unknown as HTMLElement).closest('label')
                              const input = label?.querySelector('input[type="date"]') as HTMLInputElement | null
                              input?.showPicker?.()
                            }}
                          />
                        </label>
                      </div>
                    </td>

                    {/* Day (auto) */}
                    <td className="px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-muted)', minWidth: '48px' }}>
                      {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'EEE') : '—'}
                    </td>

                    {/* Start — col 1 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 1, { minWidth: '110px' })}
                      onMouseDown={e => cellMouseDown(i, 1, e)}
                    >
                      <input type="time" value={row.start_time}
                        onChange={e => updateRow(row._key, { start_time: e.target.value })}
                        onPaste={e => handleCellPaste(e, row._key, 1)}
                        style={{ ...cellInput, userSelect: 'text' }} />
                    </td>

                    {/* End — col 2 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 2, { minWidth: '110px' })}
                      onMouseDown={e => cellMouseDown(i, 2, e)}
                    >
                      <input type="time" value={row.end_time}
                        onChange={e => updateRow(row._key, { end_time: e.target.value })}
                        onPaste={e => handleCellPaste(e, row._key, 2)}
                        style={{ ...cellInput, userSelect: 'text' }} />
                    </td>

                    {/* Teacher — col 3 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 3, { minWidth: '155px' })}
                      onMouseDown={e => cellMouseDown(i, 3, e)}
                      onPaste={e => handleCellPaste(e, row._key, 3)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <select value={row.teacher_id}
                          onChange={e => updateRow(row._key, { teacher_id: e.target.value })}
                          style={{ ...cellInput, cursor: 'pointer', flex: 1 }}>
                          <option value="">— Teacher —</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {checkAvailConflict(teachers.find(t => t.id === row.teacher_id), row.date, row.start_time) && (
                          <span title="Outside teacher's availability" style={{ flexShrink: 0, lineHeight: 0 }}><AlertTriangle size={13} style={{ color: '#D97706' }} /></span>
                        )}
                        {rowHasScheduleConflict(i) && (
                          <span title="Teacher already has an overlapping session" style={{ flexShrink: 0, lineHeight: 0 }}><AlertTriangle size={13} style={{ color: 'var(--color-danger)' }} /></span>
                        )}
                      </div>
                    </td>

                    {/* Subject — col 4 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 4, { minWidth: '140px' })}
                      onMouseDown={e => cellMouseDown(i, 4, e)}
                      onPaste={e => handleCellPaste(e, row._key, 4)}
                    >
                      <select value={row.subject_id}
                        onChange={e => updateRow(row._key, { subject_id: e.target.value })}
                        style={{ ...cellInput, cursor: 'pointer' }}>
                        <option value="">— Subject —</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>

                    {/* Status — col 5 */}
                    <td
                      className="px-2 py-1.5"
                      style={cellTdStyle(i, 5, { minWidth: '125px' })}
                      onMouseDown={e => cellMouseDown(i, 5, e)}
                      onPaste={e => handleCellPaste(e, row._key, 5)}
                    >
                      <select value={row.status}
                        onChange={e => {
                          const val = e.target.value as SessionStatus
                          updateRow(row._key, { status: val, _statusLocked: true })
                        }}
                        className="text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ border: 'none', outline: 'none', cursor: 'pointer', ...STATUS_COLORS[row.status] }}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>

                    <td className="px-2 py-1.5" style={{ width: '40px' }}>
                      <button onClick={() => removeRow(row._key)} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--color-danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#0BB5C7' }}>
            <Plus size={14} /> Add row
          </button>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
              style={{ backgroundColor: '#0BB5C7' }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add Sessions'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close confirmation dialog */}
      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm space-y-4"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Discard unsaved sessions?
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              You have rows with data that haven&apos;t been saved. Closing will discard all unsaved sessions.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Stay
              </button>
              <button
                onClick={() => { setShowCloseConfirm(false); onClose() }}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
