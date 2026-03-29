'use client'

import React, { useState, useEffect, useRef } from 'react'
import { format, parseISO, isToday, isBefore, startOfDay, parse, isValid } from 'date-fns'
import { Pencil, Trash2, Loader2, Check, CalendarDays, Plus, AlertTriangle, Download, ChevronDown, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { logActivity } from '@/app/actions'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow, SubjectRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import TimeInput from '@/app/dashboard/components/TimeInput'
import RichTextEditor from '@/app/dashboard/components/RichTextEditor'
import { sanitizeClientHtml } from '@/lib/sanitizeClient'

interface Sel { r1: number; r2: number; c1: number; c2: number }

// col 0=Date,1=Day,2=Time,3=Subject,4=Topic,5=Class,6=Teacher,7=Status,8=Students
function getCell(s: SessionRow, c: number): string {
  if (c === 0) return s.date ? format(parseISO(s.date), 'MMM d, yyyy') : ''
  if (c === 1) return s.date ? format(parseISO(s.date), 'EEE') : ''
  if (c === 2) return s.start_time && s.end_time ? `${fmt12(s.start_time)} – ${fmt12(s.end_time)}` : ''
  if (c === 3) return s.subjects?.name ?? '—'
  if (c === 4) return s.topic ?? '—'
  if (c === 5) return s.classes?.name ?? '—'
  if (c === 6) return s.teachers?.name ?? '—'
  if (c === 7) return STATUS_OPTIONS.find(o => o.value === s.status)?.label ?? s.status
  if (c === 8) return s.student_count > 0 ? String(s.student_count) : '—'
  return ''
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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

// ─── DraftRow ─────────────────────────────────────────────────────────────────

interface DraftRow {
  _key: string
  id?: string
  class_id: string
  date: string
  start_time: string
  end_time: string
  teacher_id: string
  subject_ids: string[]
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
    start_time: s.start_time?.slice(0, 5) ?? '',
    end_time: s.end_time?.slice(0, 5) ?? '',
    teacher_id: s.teacher_id ?? '',
    subject_ids: [
      ...(s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []),
      ...((s as SessionRow & { is_assessment?: boolean }).is_assessment ? ['__assessment__'] : []),
    ],
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
    teacher_id: '', subject_ids: [], topic: '', status: 'scheduled',
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
  onBulkDelete: (ids: string[]) => void
  onSessionsChanged: (saved: SessionRow[]) => void
  classes: ClassRow[]
  teachers: TeacherRow[]
  subjectsByClass: Map<string, SubjectRow[]>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleTable({
  sessions, selected, onSelectToggle, onSelectAll,
  onBulkDelete, onSessionsChanged,
  classes, teachers, subjectsByClass,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)
  const [cleanupRowKeys, setCleanupRowKeys] = useState<Set<string>>(new Set())
  const savedSnapshot = useRef<DraftRow[]>([])
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const [openSubjectKey, setOpenSubjectKey] = useState<string | null>(null)
  const [subjectDropPos, setSubjectDropPos] = useState<{ top: number; left: number } | null>(null)
  const [expandedTopicKeys, setExpandedTopicKeys] = useState<Set<string>>(new Set())

  function toggleTopicExpand(key: string) {
    setExpandedTopicKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function getEditRowCell(row: DraftRow, c: number): string {
    if (c === 0) return row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date
    if (c === 1) return row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'EEE') : '—'
    if (c === 2) return row.start_time
    if (c === 3) return row.end_time
    if (c === 4) return classes.find(cl => cl.id === row.class_id)?.name ?? '—'
    if (c === 5) return teachers.find(t => t.id === row.teacher_id)?.name ?? '—'
    if (c === 6) {
      const subs = subjectsByClass.get(row.class_id) ?? []
      return row.subject_ids.map(id => id === '__assessment__' ? 'Assessment' : subs.find(s => s.id === id)?.name ?? id).join(', ') || '—'
    }
    if (c === 7) return row.topic
    if (c === 8) return STATUS_OPTIONS.find(o => o.value === row.status)?.label ?? row.status
    return ''
  }

  function applyCellValueInEdit(row: DraftRow, c: number, raw: string): Partial<DraftRow> {
    const v = raw.trim()
    if (c === 0) { const d = parseDate(v); return d ? { date: d } : {} }
    if (c === 1) return {} // day is auto-computed
    if (c === 2) { const t = parseTime(v); return t ? { start_time: t } : {} }
    if (c === 3) { const t = parseTime(v); return t ? { end_time: t } : {} }
    if (c === 4) {
      if (!row._isNew) return {}
      const match = classes.find(cl => cl.name.toLowerCase() === v.toLowerCase())
      return match ? { class_id: match.id, subject_ids: [] } : {}
    }
    if (c === 5) {
      const match = teachers.find(t => t.name.toLowerCase() === v.toLowerCase())
      return match ? { teacher_id: match.id } : {}
    }
    if (c === 6) {
      const subs = subjectsByClass.get(row.class_id) ?? []
      const ASSESSMENT_ID = '__assessment__'
      const names = v.split(',').map(s => s.trim().toLowerCase())
      const ids = names.map(n => {
        if (n === 'assessment') return ASSESSMENT_ID
        return subs.find(s => s.name.toLowerCase() === n)?.id
      }).filter(Boolean) as string[]
      return ids.length > 0 ? { subject_ids: ids } : {}
    }
    if (c === 7) return { topic: v }
    if (c === 8) {
      const match = STATUS_OPTIONS.find(o => o.label.toLowerCase() === v.toLowerCase() || o.value === v.toLowerCase())
      return match ? { status: match.value, _statusLocked: true } : {}
    }
    return {}
  }

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !sel) return
      const el = document.activeElement
      const inInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      const hasTextSel = inInput && (el as HTMLInputElement).selectionStart !== (el as HTMLInputElement).selectionEnd

      const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)]
      const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)]

      if (e.key === 'c') {
        if (hasTextSel) return
        e.preventDefault()
        if (editMode) {
          const text = rows.slice(r1, r2 + 1)
            .map(row => Array.from({ length: c2 - c1 + 1 }, (_, i) => getEditRowCell(row, c1 + i)).join('\t'))
            .join('\n')
          navigator.clipboard.writeText(text)
        } else {
          const text = sessions.slice(r1, r2 + 1)
            .map(s => Array.from({ length: c2 - c1 + 1 }, (_, i) => getCell(s, c1 + i)).join('\t'))
            .join('\n')
          navigator.clipboard.writeText(text)
        }
      }

      if (e.key === 'v' && editMode) {
        if (hasTextSel) return
        const active = document.activeElement
        if (active instanceof HTMLElement && active.contentEditable === 'true') return
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text.trim()) return
          const pastedMatrix = text.trim().split('\n').map(r => r.split('\t'))
          setRows(prev => {
            const next = [...prev]
            const isSingleValue = pastedMatrix.length === 1 && pastedMatrix[0].length === 1
            if (isSingleValue) {
              // Fill entire selection with the single value
              const raw = pastedMatrix[0][0]
              for (let ri = r1; ri <= r2; ri++) {
                if (ri >= next.length) break
                for (let ci = c1; ci <= c2; ci++) {
                  const row = { ...next[ri] }
                  const updates = applyCellValueInEdit(row, ci, raw)
                  if (!Object.keys(updates).length) continue
                  Object.assign(row, updates, { _dirty: true })
                  if (!row._statusLocked && (updates.date !== undefined || updates.start_time !== undefined || updates.end_time !== undefined))
                    row.status = autoStatus(row.date, row.start_time, row.end_time)
                  next[ri] = row
                }
              }
            } else {
              // Multi-cell: paste from top-left of selection
              for (let pr = 0; pr < pastedMatrix.length; pr++) {
                const ri = r1 + pr
                if (ri >= next.length) break
                for (let pc = 0; pc < pastedMatrix[pr].length; pc++) {
                  const ci = c1 + pc
                  if (ci > 8) break // 9 data columns (0–8)
                  const row = { ...next[ri] }
                  const updates = applyCellValueInEdit(row, ci, pastedMatrix[pr][pc])
                  if (!Object.keys(updates).length) continue
                  Object.assign(row, updates, { _dirty: true })
                  if (!row._statusLocked && (updates.date !== undefined || updates.start_time !== undefined || updates.end_time !== undefined))
                    row.status = autoStatus(row.date, row.start_time, row.end_time)
                  next[ri] = row
                }
              }
            }
            return next
          })
        })
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, sessions, rows, editMode])

  function cellMouseDown(r: number, c: number, e: React.MouseEvent) {
    if (activeCell && (activeCell.r !== r || activeCell.c !== c)) setActiveCell(null)
    if (e.shiftKey && anchorRef.current) {
      setSel({ r1: anchorRef.current.r, r2: r, c1: anchorRef.current.c, c2: c })
    } else {
      anchorRef.current = { r, c }
      setSel({ r1: r, r2: r, c1: c, c2: c })
    }
  }

  // Focus the active cell's input after render
  useEffect(() => {
    if (!activeCell) return
    const key = `${activeCell.r}-${activeCell.c}`
    requestAnimationFrame(() => {
      const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${key}"] input:not([type="date"]):not([type="checkbox"])`)
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    })
  }, [activeCell])

  // Escape → deactivate; Delete/Backspace → clear; printable key → activate + replace
  useEffect(() => {
    if (!editMode) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') { setActiveCell(null); return }
      if ((e.key === 'Backspace' || e.key === 'Delete') && sel) {
        const el = document.activeElement
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return
        e.preventDefault()
        const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
        const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)
        setRows(prev => {
          const next = [...prev]
          for (let r = r1; r <= r2; r++) {
            if (!next[r]) continue
            const row = { ...next[r], _dirty: true }
            for (let c = c1; c <= c2; c++) {
              if (c === 0) row.date = ''
              else if (c === 2) row.start_time = ''
              else if (c === 3) row.end_time = ''
              else if (c === 5) row.teacher_id = ''
              else if (c === 6) row.subject_ids = []
              else if (c === 7) row.topic = ''
            }
            if (!row._statusLocked && (c1 <= 3)) row.status = autoStatus(row.date, row.start_time, row.end_time)
            next[r] = row
          }
          return next
        })
        return
      }
      if (!sel || e.altKey || e.metaKey || e.ctrlKey || e.key?.length !== 1) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return
      const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
      const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)
      if (r1 !== r2 || c1 !== c2) return
      if (![0, 2, 3].includes(c1)) return // date (0), start time (2), end time (3)
      e.preventDefault()
      // Only replace content for the text-input date column; TimeInput just activates
      if (c1 === 0) setRows(prev => prev.map((row, ri) => ri === r1 ? { ...row, date: e.key, _dirty: true } : row))
      setActiveCell({ r: r1, c: c1 })
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [editMode, sel])

  function inSel(r: number, c: number) {
    if (!sel) return false
    return r >= Math.min(sel.r1, sel.r2) && r <= Math.max(sel.r1, sel.r2)
      && c >= Math.min(sel.c1, sel.c2) && c <= Math.max(sel.c1, sel.c2)
  }

  function cs(r: number, c: number): React.CSSProperties {
    return inSel(r, c)
      ? { backgroundColor: 'rgba(11,181,199,0.1)', boxShadow: 'inset 0 0 0 1px rgba(11,181,199,0.45)' }
      : {}
  }

  const allSelected = sessions.length > 0 && selected.size === sessions.length
  const dirtyCount = rows.filter(r => r._dirty).length + deletedIds.size

  function enterEditMode() {
    savedSnapshot.current = sessions.map(sessionToRow)
    setRows(sessions.map(sessionToRow))
    setDeletedIds(new Set())
    setSaveError('')
    setSaved(false)
    setSel(null)
    setEditMode(true)
  }

  function discardAndExit() {
    setRows([...savedSnapshot.current])
    setDeletedIds(new Set())
    setSel(null)
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

  function handleSave() {
    const blankRows = rows.filter(r => r._isNew && !r.date && !r.start_time && !r.end_time && !r.teacher_id && !r.subject_ids.length)
    if (blankRows.length > 0) {
      setCleanupRowKeys(new Set(blankRows.map(r => r._key)))
      setShowCleanupDialog(true)
      return
    }
    doSave(rows)
  }

  async function doSave(rowsToSave: typeof rows) {
    const invalidRows: number[] = []
    rowsToSave.forEach((r, i) => {
      if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) invalidRows.push(i + 1)
    })
    if (invalidRows.length > 0) {
      setSaveError(`Row${invalidRows.length > 1 ? 's' : ''} ${invalidRows.join(', ')}: invalid date. Use M/D/YYYY format.`)
      return
    }
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const toInsert = rowsToSave.filter(r => r._isNew && r.date)
    const toUpdate = rowsToSave.filter(r => !r._isNew && r._dirty && r.id)

    try {
      if (deletedIds.size > 0) {
        const { error } = await supabase.from('sessions').delete().in('id', Array.from(deletedIds))
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('sessions').insert(
          toInsert.map(r => {
            const dbSubIds = r.subject_ids.filter(id => id !== '__assessment__')
            const isAssessment = r.subject_ids.includes('__assessment__')
            return {
              class_id: r.class_id, date: r.date, start_time: r.start_time || null, end_time: r.end_time || null,
              teacher_id: r.teacher_id || null,
              subject_ids: dbSubIds,
              subject_id: dbSubIds[0] || null,
              is_assessment: isAssessment,
              topic: r.topic || null, status: r.status,
            }
          }))
        if (error) throw error
      }

      for (const r of toUpdate) {
        const dbSubIds = r.subject_ids.filter(id => id !== '__assessment__')
        const isAssessment = r.subject_ids.includes('__assessment__')
        const { error } = await supabase.from('sessions').update({
          date: r.date, start_time: r.start_time || null, end_time: r.end_time || null,
          teacher_id: r.teacher_id || null,
          subject_ids: dbSubIds,
          subject_id: dbSubIds[0] || null,
          is_assessment: isAssessment,
          topic: r.topic || null, status: r.status,
        }).eq('id', r.id!)
        if (error) throw error
      }

      // Reload fresh data for changed/added rows
      const changedIds = toUpdate.map(r => r.id!)
      if (changedIds.length > 0) {
        const { data: fresh } = await supabase.from('sessions')
          .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, topic, class_id, subject_id, subject_ids, is_assessment, teacher_id, subjects(name), teachers(name), classes(name)')
          .in('id', changedIds)
        if (fresh) onSessionsChanged(fresh as unknown as SessionRow[])
      }

      // Reload all sessions if there were inserts or deletes
      if (toInsert.length > 0 || deletedIds.size > 0) {
        const { data: allFresh } = await supabase.from('sessions')
          .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, topic, class_id, subject_id, subject_ids, is_assessment, teacher_id, subjects(name), teachers(name), classes(name)')
          .order('date', { ascending: false }).order('start_time')
        if (allFresh) onSessionsChanged(allFresh as unknown as SessionRow[])
      }

      setDeletedIds(new Set())

      // Log what was saved
      const parts: string[] = []
      if (toInsert.length > 0) {
        const dates = toInsert.map(r => r.date).filter(Boolean).sort()
        const range = dates.length > 1 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates[0] ?? ''
        parts.push(`added ${toInsert.length} session${toInsert.length !== 1 ? 's' : ''}${range ? ` (${range})` : ''}`)
      }
      if (toUpdate.length > 0) parts.push(`updated ${toUpdate.length} session${toUpdate.length !== 1 ? 's' : ''}`)
      if (deletedIds.size > 0) parts.push(`deleted ${deletedIds.size} session${deletedIds.size !== 1 ? 's' : ''}`)
      if (parts.length > 0) {
        await logActivity('saved_sessions', 'schedule', null, 'Master Schedule', `Master Schedule: ${parts.join(', ')}`)
      }

      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const [exportingPDF, setExportingPDF] = useState(false)

  async function handleExportPDF() {
    setExportingPDF(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { default: MasterSchedulePDF } = await import('./MasterSchedulePDF')
      const ReactLib = (await import('react')).default
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const pdfRows = sessions.map((s, i) => ({
        index: i + 1,
        date: s.date ? format(parseISO(s.date), 'MMM d, yyyy') : '—',
        day: s.date ? format(parseISO(s.date), 'EEE') : '—',
        time: s.start_time && s.end_time ? `${fmt12(s.start_time)} – ${fmt12(s.end_time)}` : '—',
        subject: (() => {
          const classSubjects = subjectsByClass.get(s.class_id) ?? []
          const ids: string[] = s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []
          const effectiveIds = (s as any).is_assessment && !ids.includes('__assessment__') ? ['__assessment__', ...ids] : ids
          const names = effectiveIds.map((id: string) => id === '__assessment__' ? 'Assessment' : classSubjects.find(sub => sub.id === id)?.name ?? (s as any).subjects?.name).filter(Boolean)
          return names.join(', ') || '—'
        })(),
        topic: stripHtml(s.topic ?? ''),
        className: s.classes?.name ?? '',
        teacher: s.teachers?.name ?? '',
        status: s.status,
        students: s.student_count > 0 ? String(s.student_count) : '',
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(ReactLib.createElement(MasterSchedulePDF, { rows: pdfRows, generatedDate: today }) as any).toBlob()
      const date = new Date().toISOString().split('T')[0]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `master-schedule_${date}.pdf`; a.click()
      URL.revokeObjectURL(url)
      await logActivity('exported_pdf', 'schedule', null, 'Master Schedule', `Exported Master Schedule PDF (${pdfRows.length} sessions)`)
    } catch (e) {
      console.error('PDF export failed:', e)
    } finally {
      setExportingPDF(false)
    }
  }

  return (
    <div>
      {/* Toolbar (view mode) */}
      {!editMode && (
        <div className="flex items-center gap-2 mb-3">
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium disabled:opacity-60"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              {exportingPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {exportingPDF ? 'Generating…' : 'Export PDF'}
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--color-danger)' }}
          >
            <Trash2 size={13} /> Delete selected
          </button>
          <button
            className="ml-auto text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => onSelectAll()}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      {showCleanupDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Blank rows detected</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {cleanupRowKeys.size} new row{cleanupRowKeys.size !== 1 ? 's are' : ' is'} completely empty. Delete {cleanupRowKeys.size !== 1 ? 'them' : 'it'} before saving?
            </p>
            <div className="flex justify-end gap-3 flex-wrap pt-1">
              <button
                onClick={() => { setShowCleanupDialog(false); setCleanupRowKeys(new Set()) }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={() => { setShowCleanupDialog(false); setCleanupRowKeys(new Set()); doSave(rows) }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Keep & Save
              </button>
              <button
                onClick={() => {
                  const cleaned = rows.filter(r => !cleanupRowKeys.has(r._key))
                  setRows(cleaned)
                  setShowCleanupDialog(false)
                  setCleanupRowKeys(new Set())
                  doSave(cleaned)
                }}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}>
                Delete & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
              </div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Delete {selected.size} session{selected.size !== 1 ? 's' : ''}?
              </h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              This will permanently delete the selected session{selected.size !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onBulkDelete(Array.from(selected)) }}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="mb-3 text-sm p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
          {saveError}
        </div>
      )}

      {/* Hint (view mode) */}
      {!editMode && sessions.length > 0 && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy · Ctrl/Cmd+V to paste
        </p>
      )}

      {/* Table */}
      <div
        ref={tableRef}
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
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <React.Fragment key={s.id}>
                    <tr
                      style={{
                        borderBottom: expandedTopicKeys.has(s.id) ? 'none' : (i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none'),
                        backgroundColor: selected.has(s.id) ? 'rgba(61,212,230,0.03)' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-3 w-10">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => onSelectToggle(s.id)}
                          className="rounded" style={{ accentColor: '#0BB5C7' }} />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)', cursor: 'cell', ...cs(i, 0) }}
                        onMouseDown={e => cellMouseDown(i, 0, e)}>
                        {format(parseISO(s.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', cursor: 'cell', ...cs(i, 1) }}
                        onMouseDown={e => cellMouseDown(i, 1, e)}>
                        {format(parseISO(s.date), 'EEE')}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', cursor: 'cell', ...cs(i, 2) }}
                        onMouseDown={e => cellMouseDown(i, 2, e)}>
                        {fmt12(s.start_time)} – {fmt12(s.end_time)}
                      </td>
                      <td className="px-4 py-3" style={{ cursor: 'cell', ...cs(i, 3) }}
                        onMouseDown={e => cellMouseDown(i, 3, e)}>
                        {(() => {
                          const classSubjects = subjectsByClass.get(s.class_id) ?? []
                          const ids = s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []
                          const effectiveIds = (s as any).is_assessment && !ids.includes('__assessment__') ? ['__assessment__', ...ids] : ids
                          const names = effectiveIds.map(id => id === '__assessment__' ? 'Assessment' : classSubjects.find(sub => sub.id === id)?.name ?? s.subjects?.name).filter(Boolean) as string[]
                          return names.length > 0
                            ? <div className="flex flex-wrap gap-1">{names.map((n, ni) => <span key={ni} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>{n}</span>)}</div>
                            : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        })()}
                      </td>
                      <td className="px-4 py-3" style={{ cursor: 'cell', ...cs(i, 4) }}
                        onMouseDown={e => cellMouseDown(i, 4, e)}>
                        {s.topic
                          ? <button onClick={e => { e.stopPropagation(); toggleTopicExpand(s.id) }} className="flex items-center gap-1 text-xs" style={{ color: '#0BB5C7' }}>
                              <FileText size={12} />
                              {expandedTopicKeys.has(s.id) ? 'Hide' : 'View'}
                            </button>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', cursor: 'cell', ...cs(i, 5) }}
                        onMouseDown={e => cellMouseDown(i, 5, e)}>
                        {s.classes?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', cursor: 'cell', ...cs(i, 6) }}
                        onMouseDown={e => cellMouseDown(i, 6, e)}>
                        {s.teachers?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3" style={{ cursor: 'cell', ...cs(i, 7) }}
                        onMouseDown={e => cellMouseDown(i, 7, e)}>
                        <StatusBadge status={s.status as SessionStatus} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)', cursor: 'cell', ...cs(i, 8) }}
                        onMouseDown={e => cellMouseDown(i, 8, e)}>
                        {s.student_count > 0 ? s.student_count : '—'}
                      </td>
                    </tr>
                    {expandedTopicKeys.has(s.id) && (
                      <tr style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td colSpan={10} className="px-4 pt-0 pb-3">
                          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Topic</p>
                            <div className="rich-content text-sm" style={{ color: 'var(--color-text-primary)' }} dangerouslySetInnerHTML={{ __html: sanitizeClientHtml(s.topic ?? '') }} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )
        ) : (
          // ── EDIT MODE ──────────────────────────────────────────────────────
          <>
            {openSubjectKey && (
              <div className="fixed inset-0 z-[149]" onClick={() => { setOpenSubjectKey(null); setSubjectDropPos(null) }} />
            )}
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
                    <React.Fragment key={row._key}>
                      <tr style={{ borderBottom: expandedTopicKeys.has(row._key) ? 'none' : (i < rows.length - 1 ? '1px solid var(--color-border)' : 'none') }}>
                        {/* # */}
                        <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--color-text-muted)', width: '36px' }}>{i + 1}</td>

                        {/* Date */}
                        <td data-cell={`${i}-0`} className="px-2 py-1.5" style={{ minWidth: '160px', ...cs(i, 0) }}
                          onMouseDown={e => cellMouseDown(i, 0, e)}
                          onDoubleClick={() => setActiveCell({ r: i, c: 0 })}>
                          {activeCell?.r === i && activeCell?.c === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input type="text"
                                value={row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date}
                                placeholder="M/D/YYYY"
                                onChange={e => { const p = parseDate(e.target.value); updateRow(row._key, { date: p || e.target.value }) }}
                                onBlur={e => { const p = parseDate(e.target.value); if (p) updateRow(row._key, { date: p }); setActiveCell(null) }}
                                style={{ ...cellInput, flex: 1, minWidth: 0, outline: row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? '1.5px solid #EF4444' : 'none', borderRadius: '3px' }} />
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
                          ) : (
                            <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px', outline: row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? '1.5px solid #EF4444' : 'none', borderRadius: '3px' }}>
                              {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
                                ? format(parseISO(row.date), 'M/d/yyyy')
                                : row.date
                                  ? <span style={{ color: '#EF4444' }}>{row.date}</span>
                                  : <span style={{ opacity: 0.35 }}>M/D/YYYY</span>}
                            </div>
                          )}
                        </td>

                        {/* Day (auto) */}
                        <td className="px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-muted)', minWidth: '48px', cursor: 'cell', ...cs(i, 1) }}
                          onMouseDown={e => cellMouseDown(i, 1, e)}>
                          {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'EEE') : '—'}
                        </td>

                        {/* Start */}
                        <td data-cell={`${i}-2`} className="px-2 py-1.5" style={{ minWidth: '130px', ...cs(i, 2) }}
                          onMouseDown={e => cellMouseDown(i, 2, e)}
                          onDoubleClick={() => setActiveCell({ r: i, c: 2 })}
                          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveCell(null) }}>
                          {activeCell?.r === i && activeCell?.c === 2 ? (
                            <TimeInput value={row.start_time} onChange={v => updateRow(row._key, { start_time: v })} />
                          ) : (
                            <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                              {fmt12(row.start_time) || <span style={{ opacity: 0.35 }}>3:00 PM</span>}
                            </div>
                          )}
                        </td>

                        {/* End */}
                        <td data-cell={`${i}-3`} className="px-2 py-1.5" style={{ minWidth: '130px', ...cs(i, 3) }}
                          onMouseDown={e => cellMouseDown(i, 3, e)}
                          onDoubleClick={() => setActiveCell({ r: i, c: 3 })}
                          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveCell(null) }}>
                          {activeCell?.r === i && activeCell?.c === 3 ? (
                            <TimeInput value={row.end_time} onChange={v => updateRow(row._key, { end_time: v })} />
                          ) : (
                            <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                              {fmt12(row.end_time) || <span style={{ opacity: 0.35 }}>5:00 PM</span>}
                            </div>
                          )}
                        </td>

                        {/* Class (read-only label for existing, dropdown for new) */}
                        <td className="px-2 py-1.5" style={{ minWidth: '150px', ...cs(i, 4) }}
                          onMouseDown={e => cellMouseDown(i, 4, e)}>
                          {row._isNew ? (
                            <select value={row.class_id}
                              onChange={e => updateRow(row._key, { class_id: e.target.value, subject_ids: [] })}
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
                        <td className="px-2 py-1.5" style={{ minWidth: '150px', ...cs(i, 5) }}
                          onMouseDown={e => cellMouseDown(i, 5, e)}>
                          <select value={row.teacher_id}
                            onChange={e => updateRow(row._key, { teacher_id: e.target.value })}
                            style={{ ...cellInput, cursor: 'pointer' }}>
                            <option value="">— Teacher —</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>

                        {/* Subject (filtered by class) — multi-checkbox dropdown */}
                        <td className="px-2 py-1.5" style={{ minWidth: '160px', ...cs(i, 6) }}
                          onMouseDown={e => cellMouseDown(i, 6, e)}>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (openSubjectKey === row._key) {
                                setOpenSubjectKey(null); setSubjectDropPos(null)
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                setSubjectDropPos({ top: rect.bottom + 4, left: rect.left })
                                setOpenSubjectKey(row._key)
                              }
                            }}
                            style={{ ...cellInput, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                              {row.subject_ids.length === 0 ? '— Subject —' : row.subject_ids.map(id => id === '__assessment__' ? 'Assessment' : rowSubjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                            </span>
                            <ChevronDown size={11} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                          </button>
                          {openSubjectKey === row._key && subjectDropPos && (
                            <div style={{ position: 'fixed', top: subjectDropPos.top, left: subjectDropPos.left, zIndex: 150, minWidth: '180px', maxHeight: '180px', overflow: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ fontSize: '13px', borderBottom: '1px solid var(--color-border)' }}>
                                <input type="checkbox" checked={row.subject_ids.includes('__assessment__')}
                                  onChange={e => { e.stopPropagation(); updateRow(row._key, { subject_ids: row.subject_ids.includes('__assessment__') ? row.subject_ids.filter(id => id !== '__assessment__') : [...row.subject_ids, '__assessment__'] }) }}
                                  style={{ accentColor: '#0BB5C7' }} />
                                <span style={{ color: 'var(--color-text-primary)', fontStyle: 'italic' }}>Assessment</span>
                              </label>
                              {rowSubjects.length === 0
                                ? <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No subjects for this class</p>
                                : rowSubjects.map(s => (
                                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ fontSize: '13px' }}>
                                    <input type="checkbox" checked={row.subject_ids.includes(s.id)}
                                      onChange={e => { e.stopPropagation(); updateRow(row._key, { subject_ids: row.subject_ids.includes(s.id) ? row.subject_ids.filter(id => id !== s.id) : [...row.subject_ids, s.id] }) }}
                                      style={{ accentColor: '#0BB5C7' }} />
                                    <span style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                                  </label>
                                ))
                              }
                            </div>
                          )}
                        </td>

                        {/* Topic — expand button */}
                        <td className="px-2 py-1.5" style={{ minWidth: '80px', ...cs(i, 7) }}
                          onMouseDown={e => cellMouseDown(i, 7, e)}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleTopicExpand(row._key) }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                            style={{ color: row.topic ? '#0BB5C7' : 'var(--color-text-muted)', backgroundColor: row.topic ? 'rgba(11,181,199,0.08)' : 'transparent', border: row.topic ? '1px solid rgba(11,181,199,0.2)' : '1px solid transparent' }}>
                            <FileText size={12} />
                            {row.topic ? 'Edit' : 'Add'}
                          </button>
                        </td>

                        {/* Status */}
                        <td className="px-2 py-1.5" style={{ minWidth: '130px', ...cs(i, 8) }}
                          onMouseDown={e => cellMouseDown(i, 8, e)}>
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
                      {expandedTopicKeys.has(row._key) && (
                        <tr style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td colSpan={11} className="px-3 pb-2 pt-1">
                            <RichTextEditor
                              value={row.topic ?? ''}
                              onChange={v => updateRow(row._key, { topic: v })}
                              placeholder="Enter topic details…"
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </>
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
