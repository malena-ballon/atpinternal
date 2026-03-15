'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Check, Upload, Download, Pencil, Search, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { StudentRow } from '@/types'
import BulkPasteModal from './BulkPasteModal'
import { logActivity } from '@/app/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DraftRow {
  _key: string
  id?: string
  name: string
  school: string
  email: string
  _isNew: boolean
  _dirty: boolean
}

interface Sel { r1: number; r2: number; c1: number; c2: number }

interface Props {
  classId: string
  className: string
  initialStudents: StudentRow[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const PASTE_COLS = ['name', 'school', 'email'] as const

const cellInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  fontSize: '13px', color: 'var(--color-text-primary)', padding: '2px 0',
}

let _keyCounter = 0
const newKey = () => `s-${++_keyCounter}`

function studentToRow(s: StudentRow): DraftRow {
  return {
    _key: s.id, id: s.id,
    name: s.name,
    school: s.school ?? '',
    email: s.email ?? '',
    _isNew: false, _dirty: false,
  }
}

function blankRow(): DraftRow {
  return { _key: newKey(), name: '', school: '', email: '', _isNew: true, _dirty: true }
}

function getCellText(row: DraftRow, c: number): string {
  if (c === 0) return row.name
  if (c === 1) return row.school
  if (c === 2) return row.email
  return ''
}

function applyCellValue(row: DraftRow, c: number, raw: string) {
  if (c === 0) row.name = raw.trim()
  else if (c === 1) row.school = raw.trim()
  else if (c === 2) row.email = raw.trim().toLowerCase()
}

const NA_RE = /^(n\/a|na)$/i
function isBlankOrNa(v: string): boolean {
  return !v.trim() || NA_RE.test(v.trim())
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StudentsManager({ classId, className, initialStudents }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<DraftRow[]>(() =>
    [...initialStudents].sort((a, b) => a.name.localeCompare(b.name)).map(studentToRow)
  )
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const savedSnapshot = useRef<DraftRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)
  const [cleanupRowKeys, setCleanupRowKeys] = useState<Set<string>>(new Set())
  const [showDupDialog, setShowDupDialog] = useState(false)
  const [dupRowKeys, setDupRowKeys] = useState<Set<string>>(new Set())
  const [pendingSaveRows, setPendingSaveRows] = useState<DraftRow[] | null>(null)

  const dirtyCount = rows.filter(r => r._dirty).length + deletedIds.size

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

  // Ctrl+C / Ctrl+V — only active in edit mode
  useEffect(() => {
    if (!editMode) return
    const handle = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !sel) return
      const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)]
      const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)]

      if (e.key === 'c') {
        const el = document.activeElement
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart !== el.selectionEnd) return
        e.preventDefault()
        const text = rows.slice(r1, r2 + 1)
          .map(row => Array.from({ length: c2 - c1 + 1 }, (_, i) => getCellText(row, c1 + i)).join('\t'))
          .join('\n')
        navigator.clipboard.writeText(text)
      }

      if (e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text) return
          const pastedRows = text.trimEnd().split('\n')
          setRows(prev => {
            const next = [...prev]
            if (pastedRows.length === 1 && !pastedRows[0].includes('\t')) {
              // Single value: fill entire selection
              const raw = pastedRows[0].trim()
              for (let r = r1; r <= r2; r++) {
                if (!next[r]) continue
                const row = { ...next[r], _dirty: true }
                for (let c = c1; c <= c2; c++) applyCellValue(row, c, raw)
                next[r] = row
              }
            } else {
              // Multi-cell: use top-left of selection as anchor, no upper-bound clip
              for (let ri = 0; ri < pastedRows.length; ri++) {
                const rowIdx = r1 + ri
                while (next.length <= rowIdx) next.push(blankRow())
                const cols = pastedRows[ri].split('\t')
                const row = { ...next[rowIdx], _dirty: true }
                for (let ci = 0; ci < cols.length; ci++) {
                  if (c1 + ci >= PASTE_COLS.length) break
                  applyCellValue(row, c1 + ci, cols[ci].trim())
                }
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
  }, [editMode, sel, rows])

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
      const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${key}"] input:not([type="checkbox"])`)
      if (el) { el.focus(); el.select() }
    })
  }, [activeCell])

  // Escape → deactivate; Delete/Backspace → clear; printable key → activate + replace
  useEffect(() => {
    if (!editMode) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') { setActiveCell(null); return }
      if ((e.key === 'Backspace' || e.key === 'Delete') && sel) {
        const el = document.activeElement
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
        e.preventDefault()
        const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
        const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)
        setRows(prev => {
          const next = [...prev]
          for (let r = r1; r <= r2; r++) {
            if (!next[r]) continue
            const row = { ...next[r], _dirty: true }
            for (let c = c1; c <= c2; c++) {
              if (c === 0) row.name = ''
              else if (c === 1) row.school = ''
              else if (c === 2) row.email = ''
            }
            next[r] = row
          }
          return next
        })
        return
      }
      if (!sel || e.altKey || e.metaKey || e.ctrlKey || e.key?.length !== 1) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2)
      const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2)
      if (r1 !== r2 || c1 !== c2) return
      if (![0, 1, 2].includes(c1)) return
      e.preventDefault()
      setRows(prev => {
        const next = [...prev]
        const row = { ...next[r1], _dirty: true }
        if (c1 === 0) row.name = e.key
        else if (c1 === 1) row.school = e.key
        else if (c1 === 2) row.email = e.key
        next[r1] = row
        return next
      })
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

  function addRow() { setRows(prev => [...prev, blankRow()]) }

  function removeRow(key: string, id?: string) {
    setRows(prev => prev.filter(r => r._key !== key))
    if (id) setDeletedIds(prev => new Set([...prev, id]))
  }

  function updateRow(key: string, field: keyof DraftRow, value: string) {
    setRows(prev => prev.map(r =>
      r._key !== key ? r : { ...r, [field]: value, _dirty: true }
    ))
  }

  function handleCellPaste(e: React.ClipboardEvent, rowKey: string, startCol: number) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text.trim()) return
    const pastedRows = text.trimEnd().split('\n')
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
          applyCellValue(row, startCol + ci, cols[ci].trim())
        }
        next[ti] = row
      }
      return next
    })
  }

  function findDupNameKeys(rowsToCheck: DraftRow[]): Set<string> {
    const seen = new Set<string>()
    const dups = new Set<string>()
    rowsToCheck.forEach(r => {
      const n = r.name.trim().toLowerCase()
      if (!n) return
      if (seen.has(n)) dups.add(r._key)
      else seen.add(n)
    })
    return dups
  }

  function checkDupsAndSave(rowsToCheck: DraftRow[]) {
    const dups = findDupNameKeys(rowsToCheck)
    if (dups.size > 0) {
      setDupRowKeys(dups)
      setPendingSaveRows(rowsToCheck)
      setShowDupDialog(true)
      return
    }
    doSave(rowsToCheck)
  }

  function handleSave() {
    const blankNaRows = rows.filter(r => r._isNew && isBlankOrNa(r.name) && isBlankOrNa(r.school) && isBlankOrNa(r.email))
    if (blankNaRows.length > 0) {
      setCleanupRowKeys(new Set(blankNaRows.map(r => r._key)))
      setShowCleanupDialog(true)
      return
    }
    checkDupsAndSave(rows)
  }

  async function doSave(rowsToSave: DraftRow[]) {
    setSaving(true); setSaveError('')

    const supabase = createClient()
    const dirtyRows = rowsToSave.filter(r => r._dirty)
    try {
      if (deletedIds.size > 0) {
        const { error } = await supabase
          .from('class_students').delete()
          .eq('class_id', classId).in('student_id', Array.from(deletedIds))
        if (error) throw error
      }
      for (const row of dirtyRows) {
        if (!row.name.trim()) continue
        if (row._isNew) {
          const { data: student, error } = await supabase
            .from('students')
            .upsert(
              { name: row.name.trim(), school: row.school.trim() || null, email: row.email.trim().toLowerCase() || null },
              { onConflict: 'email' }
            )
            .select('id').single()
          if (error || !student) throw error ?? new Error('Failed to save student')
          await supabase
            .from('class_students')
            .upsert({ class_id: classId, student_id: student.id }, { onConflict: 'class_id,student_id' })
        } else if (row.id) {
          const { error } = await supabase
            .from('students')
            .update({ name: row.name.trim(), school: row.school.trim() || null, email: row.email.trim().toLowerCase() || null })
            .eq('id', row.id)
          if (error) throw error
        }
      }
      // Reload fresh data
      const { data: fresh } = await supabase
        .from('class_students')
        .select('enrolled_at, students(id, name, school, email, created_at)')
        .eq('class_id', classId)
        .order('enrolled_at', { ascending: false })
      if (fresh) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshRows = fresh.map((cs: any) => cs.students as StudentRow).filter(Boolean).map(studentToRow)
        setRows(freshRows)
      }
      setDeletedIds(new Set())
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setEditMode(false)
      router.refresh()

      const addedNames = dirtyRows.filter(r => r._isNew).map(r => r.name.trim())
      const updatedNames = dirtyRows.filter(r => !r._isNew).map(r => r.name.trim())
      const removedNames = rowsToSave.filter(r => r.id && deletedIds.has(r.id)).map(r => r.name.trim())
      function fmtNames(names: string[]) {
        return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
      }
      const parts: string[] = []
      if (addedNames.length) parts.push(`added ${addedNames.length}: ${fmtNames(addedNames)}`)
      if (updatedNames.length) parts.push(`updated ${updatedNames.length}: ${fmtNames(updatedNames)}`)
      if (removedNames.length) parts.push(`removed ${removedNames.length}: ${fmtNames(removedNames)}`)
      if (parts.length) await logActivity('updated_students', 'class', classId, className, `In "${className}" students: ${parts.join(' | ')}`)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleBulkImported(imported: StudentRow[]) {
    setRows(prev => {
      const map = new Map(prev.map(r => [r.id, r]))
      imported.forEach(s => { if (!map.has(s.id)) map.set(s.id, studentToRow(s)) })
      return Array.from(map.values())
    })
    setShowBulk(false)
  }

  function toggleSelectKey(key: string) {
    setSelectedKeys(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }

  function toggleSelectAll(visibleKeys: string[]) {
    setSelectedKeys(prev => prev.size === visibleKeys.length ? new Set() : new Set(visibleKeys))
  }

  async function handleDeleteSelected() {
    if (selectedKeys.size === 0) return
    if (!window.confirm(`Delete ${selectedKeys.size} student${selectedKeys.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeletingSelected(true)
    const supabase = createClient()
    const idsToDelete = rows.filter(r => selectedKeys.has(r._key) && r.id).map(r => r.id!)
    if (idsToDelete.length > 0) {
      await supabase.from('class_students').delete().eq('class_id', classId).in('student_id', idsToDelete)
    }
    setRows(prev => prev.filter(r => !selectedKeys.has(r._key)))
    setSelectedKeys(new Set())
    setDeletingSelected(false)
    router.refresh()
  }

  const filteredRows = !editMode && q.trim()
    ? rows.filter(r =>
        r.name.toLowerCase().includes(q.toLowerCase()) ||
        r.school.toLowerCase().includes(q.toLowerCase()) ||
        r.email.toLowerCase().includes(q.toLowerCase())
      )
    : rows

  const nameCounts = new Map<string, number>()
  rows.forEach(r => { const n = r.name.trim().toLowerCase(); if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1) })
  const dupNameKeys = new Set(rows.filter(r => (nameCounts.get(r.name.trim().toLowerCase()) ?? 0) > 1).map(r => r._key))

  function exportCSV() {
    const header = 'Name,School,Email'
    const csvRows = rows.map(r =>
      [r.name, r.school, r.email].map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    )
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `students-${classId.slice(0, 8)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function cellStyle(r: number, c: number, row: DraftRow): React.CSSProperties {
    const selected = inSel(r, c)
    const isDupName = c === 0 && dupNameKeys.has(row._key)
    return {
      backgroundColor: selected ? 'rgba(11,181,199,0.1)' : isDupName ? 'rgba(239,68,68,0.08)' : row._dirty ? 'rgba(61,212,230,0.02)' : 'transparent',
      boxShadow: selected ? 'inset 0 0 0 1px rgba(11,181,199,0.45)' : isDupName ? 'inset 0 0 0 1px rgba(239,68,68,0.25)' : 'none',
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {q.trim() && !editMode ? `${filteredRows.length} of ${rows.length}` : rows.length} student{rows.length !== 1 ? 's' : ''}
        </span>

        {!editMode && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search students…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                padding: '7px 10px 7px 30px', borderRadius: '10px',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none', width: '200px',
              }}
            />
          </div>
        )}
        {!editMode && q && (
          <button onClick={() => setQ('')} className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <X size={12} /> Clear
          </button>
        )}

        {!editMode && selectedKeys.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deletingSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium disabled:opacity-60"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
            {deletingSelected ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete {selectedKeys.size} selected
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Download size={12} /> Export CSV
          </button>

          {editMode && (
            <button
              onClick={() => setShowBulk(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <Upload size={12} /> Paste Import
            </button>
          )}

          {!editMode && (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}>
              <Pencil size={13} /> Edit
            </button>
          )}

          {editMode && (
            <>
              {dirtyCount > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={handleExit}
                className="px-4 py-1.5 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Exit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
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
      <div ref={tableRef} className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full" style={{ minWidth: '520px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              {!editMode && (
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every(r => selectedKeys.has(r._key))}
                    onChange={() => toggleSelectAll(filteredRows.map(r => r._key))}
                    style={{ accentColor: '#0BB5C7' }}
                  />
                </th>
              )}
              {['#', 'Name', 'School', 'Email', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {editMode ? 'No students yet. Add a row or use Paste Import.' : q.trim() ? 'No students match your search.' : 'No students yet. Click Edit to add students.'}
                </td>
              </tr>
            )}
            {filteredRows.map((row, i) => (
              <tr key={row._key} style={{ borderBottom: i < filteredRows.length - 1 ? '1px solid var(--color-border)' : 'none', backgroundColor: !editMode && selectedKeys.has(row._key) ? 'rgba(61,212,230,0.04)' : dupNameKeys.has(row._key) ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                {!editMode && (
                  <td className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row._key)}
                      onChange={() => toggleSelectKey(row._key)}
                      style={{ accentColor: '#0BB5C7' }}
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--color-text-muted)', width: '36px' }}>{i + 1}</td>

                {!editMode ? (
                  // ── View mode ─────────────────────────────────────────────
                  <>
                    <td className="px-3 py-2.5 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.name || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{row.school || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{row.email || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                    <td />
                  </>
                ) : (
                  // ── Edit mode ─────────────────────────────────────────────
                  <>
                    {/* Name col=0 */}
                    <td data-cell={`${i}-0`} className="px-2 py-1.5" style={{ minWidth: '180px', ...cellStyle(i, 0, row) }}
                      onMouseDown={e => cellMouseDown(i, 0, e)}
                      onDoubleClick={() => setActiveCell({ r: i, c: 0 })}>
                      {activeCell?.r === i && activeCell?.c === 0 ? (
                        <input
                          type="text"
                          value={row.name}
                          placeholder="Full name"
                          onChange={e => updateRow(row._key, 'name', e.target.value)}
                          onPaste={e => handleCellPaste(e, row._key, 0)}
                          onBlur={() => setActiveCell(null)}
                          style={cellInput}
                        />
                      ) : (
                        <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                          {row.name || <span style={{ opacity: 0.35 }}>Full name</span>}
                        </div>
                      )}
                    </td>

                    {/* School col=1 */}
                    <td data-cell={`${i}-1`} className="px-2 py-1.5" style={{ minWidth: '160px', ...cellStyle(i, 1, row) }}
                      onMouseDown={e => cellMouseDown(i, 1, e)}
                      onDoubleClick={() => setActiveCell({ r: i, c: 1 })}>
                      {activeCell?.r === i && activeCell?.c === 1 ? (
                        <input
                          type="text"
                          value={row.school}
                          placeholder="School"
                          onChange={e => updateRow(row._key, 'school', e.target.value)}
                          onPaste={e => handleCellPaste(e, row._key, 1)}
                          onBlur={() => setActiveCell(null)}
                          style={cellInput}
                        />
                      ) : (
                        <div style={{ ...cellInput, userSelect: 'none', minHeight: '20px' }}>
                          {row.school || <span style={{ opacity: 0.35 }}>School</span>}
                        </div>
                      )}
                    </td>

                    {/* Email col=2 */}
                    <td data-cell={`${i}-2`} className="px-2 py-1.5" style={{ minWidth: '200px', ...cellStyle(i, 2, row) }}
                      onMouseDown={e => cellMouseDown(i, 2, e)}
                      onDoubleClick={() => setActiveCell({ r: i, c: 2 })}>
                      {activeCell?.r === i && activeCell?.c === 2 ? (
                        <input
                          type="text"
                          value={row.email}
                          placeholder="email@example.com"
                          onChange={e => updateRow(row._key, 'email', e.target.value)}
                          onPaste={e => handleCellPaste(e, row._key, 2)}
                          onBlur={() => setActiveCell(null)}
                          style={{ ...cellInput, fontFamily: 'monospace' }}
                        />
                      ) : (
                        <div style={{ ...cellInput, fontFamily: 'monospace', userSelect: 'none', minHeight: '20px' }}>
                          {row.email || <span style={{ opacity: 0.35, fontFamily: 'inherit' }}>email@example.com</span>}
                        </div>
                      )}
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-1.5" style={{ width: '40px' }}>
                      <button
                        onClick={() => removeRow(row._key, row.id)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: 'var(--color-danger)' }}>
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
        <button
          onClick={addRow}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium"
          style={{ color: '#0BB5C7' }}>
          <Plus size={14} /> Add row
        </button>
      )}

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Discard changes?</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              You have {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}. They will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Keep editing
              </button>
              <button
                onClick={discardAndExit}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {showCleanupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Blank / N/A rows detected</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {cleanupRowKeys.size} row{cleanupRowKeys.size !== 1 ? 's are' : ' is'} blank or contain only N/A values. Delete {cleanupRowKeys.size !== 1 ? 'them' : 'it'} before saving?
            </p>
            <div className="flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => { setShowCleanupDialog(false); setCleanupRowKeys(new Set()) }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={() => { setShowCleanupDialog(false); setCleanupRowKeys(new Set()); checkDupsAndSave(rows) }}
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
                  checkDupsAndSave(cleaned)
                }}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}>
                Delete & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Duplicate names detected</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {dupRowKeys.size} row{dupRowKeys.size !== 1 ? 's have' : ' has'} a duplicate name (later occurrence{dupRowKeys.size !== 1 ? 's' : ''}). Delete {dupRowKeys.size !== 1 ? 'them' : 'it'} before saving?
            </p>
            <div className="flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => { setShowDupDialog(false); setDupRowKeys(new Set()); setPendingSaveRows(null) }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const r = pendingSaveRows ?? rows
                  setShowDupDialog(false); setDupRowKeys(new Set()); setPendingSaveRows(null)
                  doSave(r)
                }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Keep & Save
              </button>
              <button
                onClick={() => {
                  const cleaned = (pendingSaveRows ?? rows).filter(r => !dupRowKeys.has(r._key))
                  setRows(cleaned)
                  setShowDupDialog(false)
                  setDupRowKeys(new Set())
                  setPendingSaveRows(null)
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

      {showBulk && (
        <BulkPasteModal
          classId={classId}
          existingStudents={rows.filter(r => r.id).map(r => ({
            id: r.id!, name: r.name, school: r.school || null,
            email: r.email || null, created_at: '',
          }))}
          onClose={() => setShowBulk(false)}
          onImported={handleBulkImported}
        />
      )}
    </div>
  )
}
