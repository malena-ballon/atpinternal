'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Loader2, Check, Upload, Download, Pencil, Search, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { StudentRow } from '@/types'
import BulkPasteModal from './BulkPasteModal'

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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StudentsManager({ classId, initialStudents }: Props) {
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
  const savedSnapshot = useRef<DraftRow[]>([])

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
        const selSize = (r2 - r1 + 1) * (c2 - c1 + 1)
        if (selSize <= 1) return
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text) return
          const pastedRows = text.trim().split('\n').filter(Boolean)
          setRows(prev => {
            const next = [...prev]
            if (pastedRows.length === 1 && !pastedRows[0].includes('\t')) {
              const raw = pastedRows[0].trim()
              for (let r = r1; r <= r2; r++) {
                if (!next[r]) continue
                const row = { ...next[r], _dirty: true }
                for (let c = c1; c <= c2; c++) applyCellValue(row, c, raw)
                next[r] = row
              }
            } else {
              for (let ri = 0; ri < pastedRows.length && r1 + ri <= r2; ri++) {
                const cols = pastedRows[ri].split('\t')
                const row = { ...next[r1 + ri], _dirty: true }
                for (let ci = 0; ci < cols.length && c1 + ci <= c2; ci++)
                  applyCellValue(row, c1 + ci, cols[ci].trim())
                next[r1 + ri] = row
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
    if (e.shiftKey && anchorRef.current) {
      setSel({ r1: anchorRef.current.r, r2: r, c1: anchorRef.current.c, c2: c })
    } else {
      anchorRef.current = { r, c }
      setSel({ r1: r, r2: r, c1: c, c2: c })
    }
  }

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
          applyCellValue(row, startCol + ci, cols[ci].trim())
        }
        next[ti] = row
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const dirtyRows = rows.filter(r => r._dirty)
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
    return {
      backgroundColor: selected ? 'rgba(11,181,199,0.1)' : row._dirty ? 'rgba(61,212,230,0.02)' : 'transparent',
      boxShadow: selected ? 'inset 0 0 0 1px rgba(11,181,199,0.45)' : 'none',
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {rows.length} student{rows.length !== 1 ? 's' : ''}
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
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full" style={{ minWidth: '520px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              {['#', 'Name', 'School', 'Email', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {editMode ? 'No students yet. Add a row or use Paste Import.' : 'No students yet. Click Edit to add students.'}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row._key} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
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
                    <td className="px-2 py-1.5" style={{ minWidth: '180px', ...cellStyle(i, 0, row) }}
                      onMouseDown={e => cellMouseDown(i, 0, e)}>
                      <input
                        type="text"
                        value={row.name}
                        placeholder="Full name"
                        onChange={e => updateRow(row._key, 'name', e.target.value)}
                        onPaste={e => handleCellPaste(e, row._key, 0)}
                        style={cellInput}
                      />
                    </td>

                    {/* School col=1 */}
                    <td className="px-2 py-1.5" style={{ minWidth: '160px', ...cellStyle(i, 1, row) }}
                      onMouseDown={e => cellMouseDown(i, 1, e)}>
                      <input
                        type="text"
                        value={row.school}
                        placeholder="School"
                        onChange={e => updateRow(row._key, 'school', e.target.value)}
                        onPaste={e => handleCellPaste(e, row._key, 1)}
                        style={cellInput}
                      />
                    </td>

                    {/* Email col=2 */}
                    <td className="px-2 py-1.5" style={{ minWidth: '200px', ...cellStyle(i, 2, row) }}
                      onMouseDown={e => cellMouseDown(i, 2, e)}>
                      <input
                        type="text"
                        value={row.email}
                        placeholder="email@example.com"
                        onChange={e => updateRow(row._key, 'email', e.target.value)}
                        onPaste={e => handleCellPaste(e, row._key, 2)}
                        style={{ ...cellInput, fontFamily: 'monospace' }}
                      />
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
