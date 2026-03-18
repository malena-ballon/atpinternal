'use client'

import React, { useState, useEffect, useRef } from 'react'
import { format, parseISO, isToday, isBefore, startOfDay, parse, isValid } from 'date-fns'
import { Plus, Trash2, Loader2, Check, CalendarDays, AlertTriangle, Pencil, Mail, Search, ChevronDown, X, FileText } from 'lucide-react'
import TimeInput from '@/app/dashboard/components/TimeInput'
import RichTextEditor from '@/app/dashboard/components/RichTextEditor'
import EmailComposeStep, { type EmailRecipient } from './insights/EmailComposeStep'
import { sendReportEmails, logActivity } from '@/app/actions'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, SessionStatus, SubjectRow, TeacherRow, StudentRow } from '@/types'
import ExportButton, { downloadBlob, pdfFileName } from './pdf/ExportButton'

// ─── Mini MultiSelect (same pattern as master schedule) ───────────────────────
interface MultiSelectProps {
  label: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onToggle: (v: string) => void
  onSelectAll: () => void
  onClear: () => void
}
function MultiSelect({ label, options, selected, onToggle, onSelectAll, onClear }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function out(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])
  const allSelected = selected.size === options.length
  const display = selected.size === 0 || allSelected
    ? label
    : selected.size === 1 ? options.find(o => selected.has(o.value))?.label ?? '1 selected' : `${selected.size} selected`
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} style={{ padding:'6px 10px', borderRadius:'10px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color: selected.size > 0 && !allSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', whiteSpace:'nowrap' }}>
        <span>{display}</span><ChevronDown size={12} style={{ color:'var(--color-text-muted)', flexShrink:0 }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 rounded-xl overflow-hidden" style={{ minWidth:'160px', backgroundColor:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom:'1px solid var(--color-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-muted)' }}>{label}</span>
            <div className="flex gap-2">
              <button className="text-xs px-1.5 py-0.5 rounded" style={{ color:'#0BB5C7', border:'1px solid rgba(11,181,199,0.3)' }} onClick={onSelectAll}>All</button>
              <button className="text-xs px-1.5 py-0.5 rounded" style={{ color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }} onClick={onClear}>None</button>
            </div>
          </div>
          <div style={{ maxHeight:'200px', overflowY:'auto' }}>
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer" style={{ color:'var(--color-text-primary)' }} onMouseEnter={e=>(e.currentTarget.style.backgroundColor='rgba(11,181,199,0.06)')} onMouseLeave={e=>(e.currentTarget.style.backgroundColor='')}>
                <input type="checkbox" checked={selected.has(opt.value)} onChange={() => onToggle(opt.value)} style={{ accentColor:'#0BB5C7' }} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
  subject_ids: string[]
  topic: string
  status: SessionStatus
  _statusLocked: boolean
  _isNew: boolean
  _dirty: boolean
}

interface Sel { r1: number; r2: number; c1: number; c2: number }

interface Props {
  classId: string
  className: string
  initialSessions: SessionRow[]
  subjects: SubjectRow[]
  teachers: TeacherRow[]
  students: StudentRow[]
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

function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fmt12(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// editable columns: 0=date,1=start,2=end,3=teacher,4=subject,5=topic
type PasteCol = 'date' | 'start_time' | 'end_time' | 'teacher_id' | 'subject_ids' | 'topic'
const PASTE_COLS: PasteCol[] = ['date', 'start_time', 'end_time', 'teacher_id', 'subject_ids', 'topic']

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
    start_time: s.start_time?.slice(0,5) ?? '',
    end_time: s.end_time?.slice(0,5) ?? '',
    teacher_id: s.teacher_id ?? '',
    subject_ids: [
      ...(s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []),
      ...((s as SessionRow & { is_assessment?: boolean }).is_assessment ? ['__assessment__'] : []),
    ],
    topic: s.topic ?? '',
    status: s.status as SessionStatus,
    _statusLocked: s.status === 'cancelled' || s.status === 'rescheduled',
    _isNew: false, _dirty: false,
  }
}

function blankRow(): DraftRow {
  return { _key: newKey(), date: '', start_time: '', end_time: '', teacher_id: '', subject_ids: [], topic: '',
    status: 'scheduled', _statusLocked: false, _isNew: true, _dirty: true }
}

function getCellText(row: DraftRow, c: number, teachers: TeacherRow[], subjects: SubjectRow[]): string {
  if (c === 0) return row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date), 'M/d/yyyy') : row.date
  if (c === 1) return row.start_time
  if (c === 2) return row.end_time
  if (c === 3) return teachers.find(t => t.id === row.teacher_id)?.name ?? ''
  if (c === 4) return row.subject_ids.map(id => id === '__assessment__' ? 'Assessment' : subjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')
  if (c === 5) return row.topic
  return ''
}

function applyCellValue(row: DraftRow, c: number, raw: string, teachers: TeacherRow[], subjects: SubjectRow[]) {
  const col = PASTE_COLS[c]
  if (!col) return
  if (col === 'date') { row.date = parseDate(raw) || row.date }
  else if (col === 'start_time') { row.start_time = parseTime(raw) || row.start_time }
  else if (col === 'end_time')   { row.end_time   = parseTime(raw) || row.end_time }
  else if (col === 'teacher_id') { const m = teachers.find(t => t.name.toLowerCase() === raw.toLowerCase()); if (m) row.teacher_id = m.id }
  else if (col === 'subject_ids') {
    const ASSESSMENT_ID = '__assessment__'
    const names = raw.split(',').map(s => s.trim().toLowerCase())
    const ids = names.map(n => {
      if (n === 'assessment') return ASSESSMENT_ID
      return subjects.find(s => s.name.toLowerCase() === n)?.id
    }).filter(Boolean) as string[]
    if (ids.length > 0) row.subject_ids = ids
  }
  else if (col === 'topic') { row.topic = raw.trim() }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionsSpreadsheet({ classId, className, initialSessions, subjects, teachers, students, initialStudentCount }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    [...initialSessions]
      .sort((a,b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .map(sessionToRow)
  )
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [studentCount] = useState(initialStudentCount.toString())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [generatedPDF, setGeneratedPDF] = useState<Blob | null>(null)
  const [pdfFilename, setPdfFilename] = useState('')
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [openSubjectKey, setOpenSubjectKey] = useState<string | null>(null)
  const [subjectDropPos, setSubjectDropPos] = useState<{ top: number; left: number } | null>(null)
  const [expandedTopicKeys, setExpandedTopicKeys] = useState<Set<string>>(new Set())

  // ─── Filter state (only active in view mode) ──────────────────────────────
  const [filterQ, setFilterQ] = useState('')
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())
  const [filterTeacherIds, setFilterTeacherIds] = useState<Set<string>>(new Set())
  const [filterSubjectIds, setFilterSubjectIds] = useState<Set<string>>(new Set())
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  function toggleFilter<T extends string>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setter(next)
  }
  const hasFilters = !!(filterQ || filterStatuses.size > 0 || filterTeacherIds.size > 0 || filterSubjectIds.size > 0 || filterFrom || filterTo)

  const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }))
  const subjectOptions = subjects.map(s => ({ value: s.id, label: s.name }))

  const displayRows = editMode ? rows : rows.filter(row => {
    if (filterQ) {
      const q = filterQ.toLowerCase()
      const tName = teachers.find(t => t.id === row.teacher_id)?.name ?? ''
      const sNames = row.subject_ids.map(id => subjects.find(s => s.id === id)?.name ?? '').join(' ')
      if (!tName.toLowerCase().includes(q) && !sNames.toLowerCase().includes(q)) return false
    }
    if (filterStatuses.size > 0 && !filterStatuses.has(row.status)) return false
    if (filterTeacherIds.size > 0 && !filterTeacherIds.has(row.teacher_id)) return false
    if (filterSubjectIds.size > 0 && !row.subject_ids.some(id => filterSubjectIds.has(id))) return false
    if (filterFrom && row.date < filterFrom) return false
    if (filterTo && row.date > filterTo) return false
    return true
  })

  async function handleExportPDF() {
    setIsGenerating(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { default: SessionSchedulePDF } = await import('./pdf/SessionSchedulePDF')
      const React = (await import('react')).default
      const sessionRows = displayRows.map((row, i) => {
        let day = '—'
        try { if (row.date) day = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) } catch {}
        return {
          index: i + 1,
          date: row.date ? format(parseISO(row.date), 'MMM d, yyyy') : '—',
          day,
          startTime: row.start_time,
          endTime: row.end_time,
          teacher: teachers.find(t => t.id === row.teacher_id)?.name ?? '',
          subject: row.subject_ids.map(id => id === '__assessment__' ? 'Assessment' : subjects.find(s => s.id === id)?.name).filter(Boolean).join(', '),
          topic: stripHtml(row.topic || ''),
          status: row.status,
        }
      })
      const blob = await pdf(React.createElement(SessionSchedulePDF, { className, sessions: sessionRows }) as any).toBlob()
      const fname = pdfFileName(className, 'session-schedule')
      setGeneratedPDF(blob)
      setPdfFilename(fname)
      setEmailRecipients(
        students.map(s => ({ id: s.id, name: s.name, email: s.email ?? null, enabled: true }))
      )
      setShowEmailModal(true)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDownloadOnly() {
    if (generatedPDF) downloadBlob(generatedPDF, pdfFilename)
    setShowEmailModal(false)
  }

  async function handleSendAndDownload(subject: string, body: string, signature: string, extraFiles: File[]) {
    if (!generatedPDF) return
    setIsSending(true)
    try {
      const toBase64 = (blob: Blob): Promise<string> => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })
      const pdfBase64 = await toBase64(generatedPDF)
      const enabledRecipients = emailRecipients.filter(r => r.enabled && r.email)
      const recipientData = enabledRecipients.map(r => ({
        name: r.name,
        email: r.email!,
        pdfs: [{ filename: pdfFilename, base64: pdfBase64 }],
      }))
      const extraAttachData = await Promise.all(
        extraFiles.map(async f => {
          const base64 = await toBase64(f)
          return { filename: f.name, base64 }
        })
      )
      await sendReportEmails(recipientData, subject, body, signature, extraAttachData)
      setShowEmailModal(false)
    } catch (e) {
      console.error('Send failed:', e)
    } finally {
      setIsSending(false)
    }
  }
  const savedSnapshot = useRef<DraftRow[]>([])
  const editModeRef = useRef(false)

  // Cell selection
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

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
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
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
        // Let the rich text editor handle its own paste
        const active = document.activeElement
        if (active instanceof HTMLElement && active.contentEditable === 'true') return
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text) return
          const pastedRows = text.trim().split('\n').filter(Boolean)
          setRows(prev => {
            const next = [...prev]
            if (pastedRows.length === 1 && !pastedRows[0].includes('\t')) {
              // Single value: fill selected range
              const raw = pastedRows[0].trim()
              const rEnd = r1 === r2 ? r1 : r2
              for (let r = r1; r <= rEnd; r++) {
                if (!next[r]) continue
                const row = { ...next[r], _dirty: true }
                const cEnd = c1 === c2 ? c1 : c2
                for (let c = c1; c <= cEnd; c++) applyCellValue(row, c, raw, teachers, subjects)
                if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
                next[r] = row
              }
            } else {
              // Multi-cell: paste all clipboard rows starting from r1,c1 — auto-add rows if needed
              for (let ri = 0; ri < pastedRows.length; ri++) {
                const rowIdx = r1 + ri
                while (next.length <= rowIdx) next.push(blankRow())
                const cols = pastedRows[ri].split('\t')
                const row = { ...next[rowIdx], _dirty: true }
                for (let ci = 0; ci < cols.length; ci++) {
                  if (c1 + ci > 9) break // max columns
                  applyCellValue(row, c1 + ci, cols[ci].trim(), teachers, subjects)
                }
                if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
                next[rowIdx] = row
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
              else if (c === 1) row.start_time = ''
              else if (c === 2) row.end_time = ''
              else if (c === 3) row.teacher_id = ''
              else if (c === 4) row.subject_ids = []
              else if (c === 5) row.topic = ''
            }
            if (!row._statusLocked) row.status = autoStatus(row.date, row.start_time, row.end_time)
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
      if (![0, 1, 2].includes(c1)) return // date (0), start time (1), end time (2)
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
    // Pre-validate: catch rows with invalid (non-ISO) dates
    const invalidRows: number[] = []
    rows.forEach((r, i) => {
      if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) invalidRows.push(i + 1)
    })
    if (invalidRows.length > 0) {
      setSaveError(`Row${invalidRows.length > 1 ? 's' : ''} ${invalidRows.join(', ')}: invalid date. Use M/D/YYYY format.`)
      return
    }
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const sc = parseInt(studentCount) || 0
    const toInsert = rows.filter(r => r._isNew && r.date)
    const toUpdate = rows.filter(r => !r._isNew && r._dirty && r.id)
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
            return { class_id: classId, date: r.date, start_time: r.start_time || null, end_time: r.end_time || null,
              teacher_id: r.teacher_id || null, subject_ids: dbSubIds, subject_id: dbSubIds[0] || null,
              is_assessment: isAssessment, topic: r.topic || null, status: r.status, student_count: sc }
          })
        )
        if (error) throw error
      }
      for (const r of toUpdate) {
        const dbSubIds = r.subject_ids.filter(id => id !== '__assessment__')
        const isAssessment = r.subject_ids.includes('__assessment__')
        const { error } = await supabase.from('sessions').update({
          date: r.date, start_time: r.start_time || null, end_time: r.end_time || null,
          teacher_id: r.teacher_id || null, subject_ids: dbSubIds, subject_id: dbSubIds[0] || null,
          is_assessment: isAssessment, topic: r.topic || null, status: r.status, student_count: sc,
        }).eq('id', r.id!)
        if (error) throw error
      }
      if (rows.some(r => !r._isNew))
        await supabase.from('sessions').update({ student_count: sc }).eq('class_id', classId)
      const { data: fresh } = await supabase.from('sessions')
        .select('id, date, start_time, end_time, status, student_count, zoom_link, notes, topic, class_id, subject_id, subject_ids, is_assessment, teacher_id, subjects(name), teachers(name), classes(name)')
        .eq('class_id', classId).order('date').order('start_time')
      if (fresh) setRows((fresh as unknown as SessionRow[]).map(sessionToRow))
      setDeletedIds(new Set())
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setEditMode(false)

      const changes: string[] = []
      if (deletedIds.size > 0) changes.push(`deleted ${deletedIds.size} session${deletedIds.size !== 1 ? 's' : ''}`)
      if (toInsert.length > 0) {
        const dates = toInsert.map(r => r.date).filter(Boolean).sort()
        const range = dates.length > 1 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates[0] ?? ''
        changes.push(`added ${toInsert.length} session${toInsert.length !== 1 ? 's' : ''}${range ? ` (${range})` : ''}`)
      }
      if (toUpdate.length > 0) changes.push(`updated ${toUpdate.length} session${toUpdate.length !== 1 ? 's' : ''}`)
      await logActivity('saved_sessions', 'class', classId, className, `In "${className}": ${changes.join(', ')}`)
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
        <div className="ml-auto flex items-center gap-2">
          {!editMode && (
            <>
              <ExportButton onExport={handleExportPDF} label={isGenerating ? 'Preparing...' : 'Export PDF'} />
              <button onClick={enterEditMode}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#0BB5C7' }}>
                <Pencil size={13} /> Edit
              </button>
            </>
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

      {/* Filters — view mode only */}
      {!editMode && (
        <div className="rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text" placeholder="Search teacher or subject…" value={filterQ} onChange={e => setFilterQ(e.target.value)}
              className="w-full text-sm outline-none"
              style={{ padding:'6px 10px 6px 30px', borderRadius:'10px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text-primary)', fontSize:'13px' }}
            />
          </div>
          <MultiSelect label="Teachers" options={teacherOptions} selected={filterTeacherIds}
            onToggle={v => toggleFilter(filterTeacherIds, v, setFilterTeacherIds)}
            onSelectAll={() => setFilterTeacherIds(new Set(teacherOptions.map(o => o.value)))}
            onClear={() => setFilterTeacherIds(new Set())} />
          <MultiSelect label="Subjects" options={subjectOptions} selected={filterSubjectIds}
            onToggle={v => toggleFilter(filterSubjectIds, v, setFilterSubjectIds)}
            onSelectAll={() => setFilterSubjectIds(new Set(subjectOptions.map(o => o.value)))}
            onClear={() => setFilterSubjectIds(new Set())} />
          <MultiSelect label="Status" options={STATUS_OPTIONS} selected={filterStatuses}
            onToggle={v => toggleFilter(filterStatuses, v, setFilterStatuses)}
            onSelectAll={() => setFilterStatuses(new Set(STATUS_OPTIONS.map(o => o.value)))}
            onClear={() => setFilterStatuses(new Set())} />
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date"
            style={{ padding:'6px 10px', borderRadius:'10px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text-primary)', fontSize:'13px', outline:'none' }} />
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date"
            style={{ padding:'6px 10px', borderRadius:'10px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text-primary)', fontSize:'13px', outline:'none' }} />
          {hasFilters && (
            <button onClick={() => { setFilterQ(''); setFilterStatuses(new Set()); setFilterTeacherIds(new Set()); setFilterSubjectIds(new Set()); setFilterFrom(''); setFilterTo('') }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
              <X size={11} /> Clear
            </button>
          )}
          <span className="text-xs ml-auto" style={{ color:'var(--color-text-muted)' }}>
            {displayRows.length} of {rows.length}
          </span>
        </div>
      )}

      {saveError && (
        <div className="mb-3 text-sm p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
          {saveError}
        </div>
      )}

      {openSubjectKey && <div className="fixed inset-0 z-[149]" onClick={() => { setOpenSubjectKey(null); setSubjectDropPos(null) }} />}

      {/* Table */}
      <div ref={tableRef} className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full" style={{ minWidth: '820px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              {['#','Date','Day','Start','End','Teacher','Subject','Topic','Status',''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>{rows.length === 0 ? 'No sessions yet.' : 'No sessions match the filters.'}</td></tr>
            )}
            {displayRows.map((row, i) => (
              <React.Fragment key={row._key}>
                <tr style={{ borderBottom: expandedTopicKeys.has(row._key) ? 'none' : (i < displayRows.length-1 ? '1px solid var(--color-border)' : 'none') }}>
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
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{row.start_time ? fmt12(row.start_time) : '—'}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{row.end_time ? fmt12(row.end_time) : '—'}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {teachers.find(t => t.id === row.teacher_id)?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.subject_ids.length > 0
                          ? <div className="flex flex-wrap gap-1">{row.subject_ids.map(id => { const n = id === '__assessment__' ? 'Assessment' : subjects.find(s => s.id === id)?.name; return n ? <span key={id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>{n}</span> : null })}</div>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.topic
                          ? <button onClick={() => setExpandedTopicKeys(prev => { const n = new Set(prev); n.has(row._key) ? n.delete(row._key) : n.add(row._key); return n })} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0BB5C7' }}>
                              <FileText size={12} />{expandedTopicKeys.has(row._key) ? 'Hide' : 'View'}
                            </button>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
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
                      <td data-cell={`${i}-0`} className="px-2 py-1.5" style={{ minWidth: '160px', ...cellStyle(i,0,row) }}
                        onMouseDown={e => cellMouseDown(i,0,e)}
                        onDoubleClick={() => setActiveCell({ r: i, c: 0 })}>
                        {activeCell?.r === i && activeCell?.c === 0 ? (
                          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                            <input type="text"
                              value={row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date),'M/d/yyyy') : row.date}
                              placeholder="M/D/YYYY"
                              onChange={e => { const p = parseDate(e.target.value); updateRow(row._key, { date: p || e.target.value }) }}
                              onBlur={e => { const p = parseDate(e.target.value); if (p) updateRow(row._key, { date: p }); setActiveCell(null) }}
                              onPaste={e => handleCellPaste(e, row._key, 0)}
                              style={{ ...cellInput, flex:1, minWidth:0, outline: row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? '1.5px solid #EF4444' : 'none', borderRadius: '3px' }} />
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
                      <td className="px-2 py-1.5 text-xs" style={{ color:'var(--color-text-muted)', minWidth:'48px' }}>
                        {row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? format(parseISO(row.date),'EEE') : '—'}
                      </td>

                      {/* Start col=1 */}
                      <td data-cell={`${i}-1`} className="px-2 py-1.5" style={{ minWidth:'130px', ...cellStyle(i,1,row) }}
                        onMouseDown={e => cellMouseDown(i,1,e)}
                        onDoubleClick={() => setActiveCell({ r: i, c: 1 })}
                        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveCell(null) }}>
                        {activeCell?.r === i && activeCell?.c === 1 ? (
                          <TimeInput value={row.start_time} onChange={v => updateRow(row._key,{start_time:v})} />
                        ) : (
                          <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                            {fmt12(row.start_time) || <span style={{ opacity: 0.35 }}>3:00 PM</span>}
                          </div>
                        )}
                      </td>

                      {/* End col=2 */}
                      <td data-cell={`${i}-2`} className="px-2 py-1.5" style={{ minWidth:'130px', ...cellStyle(i,2,row) }}
                        onMouseDown={e => cellMouseDown(i,2,e)}
                        onDoubleClick={() => setActiveCell({ r: i, c: 2 })}
                        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveCell(null) }}>
                        {activeCell?.r === i && activeCell?.c === 2 ? (
                          <TimeInput value={row.end_time} onChange={v => updateRow(row._key,{end_time:v})} />
                        ) : (
                          <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                            {fmt12(row.end_time) || <span style={{ opacity: 0.35 }}>5:00 PM</span>}
                          </div>
                        )}
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

                      {/* Subject col=4 — multi-checkbox dropdown */}
                      <td className="px-2 py-1.5" style={{ minWidth:'160px', ...cellStyle(i,4,row) }} onMouseDown={e => cellMouseDown(i,4,e)}
                        onPaste={e => handleCellPaste(e,row._key,4)}>
                        <button onClick={e => {
                            e.stopPropagation()
                            if (openSubjectKey === row._key) { setOpenSubjectKey(null); setSubjectDropPos(null) }
                            else {
                              const r = e.currentTarget.getBoundingClientRect()
                              setSubjectDropPos({ top: r.bottom + 4, left: r.left })
                              setOpenSubjectKey(row._key)
                            }
                          }}
                          style={{ ...cellInput, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'13px' }}>
                            {row.subject_ids.length === 0 ? '— Subject —' : row.subject_ids.map(id => id === '__assessment__' ? 'Assessment' : subjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                          </span>
                          <ChevronDown size={11} style={{ flexShrink:0, color:'var(--color-text-muted)' }} />
                        </button>
                        {openSubjectKey === row._key && subjectDropPos && (
                          <div style={{ position:'fixed', top: subjectDropPos.top, left: subjectDropPos.left, zIndex:150, minWidth:'180px', maxHeight:'200px', overflow:'auto', backgroundColor:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
                            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ fontSize:'13px', borderBottom:'1px solid var(--color-border)' }}>
                              <input type="checkbox" checked={row.subject_ids.includes('__assessment__')}
                                onChange={e => { e.stopPropagation(); updateRow(row._key, { subject_ids: row.subject_ids.includes('__assessment__') ? row.subject_ids.filter(id => id !== '__assessment__') : [...row.subject_ids, '__assessment__'] }) }}
                                style={{ accentColor:'#0BB5C7' }} />
                              <span style={{ color:'var(--color-text-primary)', fontStyle:'italic' }}>Assessment</span>
                            </label>
                            {subjects.length === 0
                              ? <p className="px-3 py-2 text-xs" style={{ color:'var(--color-text-muted)' }}>No subjects for this class</p>
                              : subjects.map(s => (
                                <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ fontSize:'13px' }}>
                                  <input type="checkbox" checked={row.subject_ids.includes(s.id)}
                                    onChange={e => { e.stopPropagation(); updateRow(row._key, { subject_ids: row.subject_ids.includes(s.id) ? row.subject_ids.filter(id => id !== s.id) : [...row.subject_ids, s.id] }) }}
                                    style={{ accentColor:'#0BB5C7' }} />
                                  <span style={{ color:'var(--color-text-primary)' }}>{s.name}</span>
                                </label>
                              ))
                            }
                          </div>
                        )}
                      </td>

                      {/* Topic col=5 — expand button */}
                      <td className="px-2 py-1.5" style={{ minWidth:'80px', ...cellStyle(i,5,row) }} onMouseDown={e => cellMouseDown(i,5,e)}>
                        <button onClick={e => { e.stopPropagation(); setExpandedTopicKeys(prev => { const n = new Set(prev); n.has(row._key) ? n.delete(row._key) : n.add(row._key); return n }) }}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                          style={{ color: row.topic ? '#0BB5C7' : 'var(--color-text-muted)', backgroundColor: row.topic ? 'rgba(11,181,199,0.08)' : 'transparent', border: row.topic ? '1px solid rgba(11,181,199,0.2)' : '1px solid transparent' }}>
                          <FileText size={12} />{row.topic ? 'Edit' : 'Add'}
                        </button>
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
                {expandedTopicKeys.has(row._key) && (
                  <tr style={{ borderBottom: i < displayRows.length-1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td colSpan={10} className="px-3 pb-2 pt-1">
                      {editMode
                        ? <RichTextEditor value={row.topic ?? ''} onChange={v => updateRow(row._key, { topic: v })} placeholder="Enter topic details…" />
                        : <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                            <div className="rich-content" style={{ color: 'var(--color-text-primary)', fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: row.topic ?? '' }} />
                          </div>
                      }
                    </td>
                  </tr>
                )}
              </React.Fragment>
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

      {/* Email compose modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh]"
            style={{ maxWidth: 520, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Mail size={15} style={{ color: '#0BB5C7' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Send via Email</h2>
            </div>
            <EmailComposeStep
              recipients={emailRecipients}
              onRecipientsChange={setEmailRecipients}
              pdfSummary="1 session schedule PDF auto-attached"
              onSend={handleSendAndDownload}
              onDownloadOnly={handleDownloadOnly}
              onBack={() => setShowEmailModal(false)}
              isSending={isSending}
            />
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
