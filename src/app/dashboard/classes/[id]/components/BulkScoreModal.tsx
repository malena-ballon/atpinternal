'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import type { ExamRow, StudentRow, ScoreRow, SubjectRow } from '@/types'

// ─── Score parsing ─────────────────────────────────────────────────────────

interface ParsedScore { score: number; total: number; pct: number }

function parseScore(raw: string): ParsedScore | null {
  const match = raw.trim().match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/)
  if (!match) return null
  const score = parseFloat(match[1])
  const total = parseFloat(match[2])
  if (isNaN(score) || isNaN(total) || total <= 0) return null
  return { score, total, pct: Math.round((score / total) * 10000) / 100 }
}

function detectTotalItems(scores: ParsedScore[]): number {
  const counts = new Map<number, number>()
  scores.forEach(s => counts.set(s.total, (counts.get(s.total) ?? 0) + 1))
  let maxCount = 0, maxTotal = 1
  counts.forEach((count, total) => { if (count > maxCount) { maxCount = count; maxTotal = total } })
  return maxTotal
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface GridRow { name: string; email: string; scores: string[] }

interface PreviewRow {
  rawName: string
  rawEmail: string
  parsedBySubject: (ParsedScore | null)[]
  totalParsed: ParsedScore | null
  student: StudentRow | null
  isUnknown: boolean
}

interface Sel { r1: number; r2: number; c1: number; c2: number }

interface Props {
  exam: ExamRow
  classId: string
  classStudents: StudentRow[]
  classPassingPct: number
  subjects: SubjectRow[]
  initialRows?: GridRow[]
  onClose: () => void
  onBack?: () => void
  onImported: (scores: ScoreRow[], detectedTotalItems: number) => void
}

const INITIAL_ROWS = 20

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
}

export default function BulkScoreModal({ exam, classId, classStudents, classPassingPct, subjects, initialRows, onClose, onBack, onImported }: Props) {
  const examSubjects: SubjectRow[] = (() => {
    const ids = exam.subject_ids?.length ? exam.subject_ids : exam.subject_id ? [exam.subject_id] : []
    return ids.map(id => subjects.find(s => s.id === id)).filter(Boolean) as SubjectRow[]
  })()

  const multiSubject = examSubjects.length > 1
  const scoreColCount = examSubjects.length > 0 ? examSubjects.length : 1

  const makeEmptyRow = (): GridRow => ({
    name: '',
    email: '',
    scores: Array(scoreColCount).fill(''),
  })

  const [gridRows, setGridRows] = useState<GridRow[]>(() => {
    if (initialRows && initialRows.length > 0) {
      const padded = [...initialRows]
      while (padded.length < INITIAL_ROWS) padded.push(makeEmptyRow())
      return padded
    }
    return Array.from({ length: INITIAL_ROWS }, makeEmptyRow)
  })

  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [unknownActions, setUnknownActions] = useState<Record<number, 'skip' | 'add'>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalWarning, setTotalWarning] = useState('')
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)

  useEffect(() => {
    if (preview) return
    function getCellValue(row: GridRow, c: number): string {
      if (c === 0) return row.name
      if (c === 1) return row.email
      return row.scores[c - 2] ?? ''
    }
    function handle(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !sel) return
      const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)]
      const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)]
      if (e.key === 'c') {
        const el = document.activeElement
        if ((el instanceof HTMLInputElement) && el.selectionStart !== el.selectionEnd) return
        e.preventDefault()
        const text = gridRows.slice(r1, r2 + 1)
          .map(row => Array.from({ length: c2 - c1 + 1 }, (_, i) => getCellValue(row, c1 + i)).join('\t'))
          .join('\n')
        navigator.clipboard.writeText(text)
      }
      if (e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (!text) return
          const lines = text.trim().split('\n').filter(Boolean)
          setGridRows(prev => {
            const next = [...prev]
            for (let ri = 0; ri < lines.length; ri++) {
              const rowIdx = r1 + ri
              if (rowIdx >= next.length) next.push(makeEmptyRow())
              const cols = lines[ri].split('\t')
              const row = { ...next[rowIdx], scores: [...next[rowIdx].scores] }
              for (let ci = 0; ci < cols.length; ci++) {
                const col = c1 + ci
                const val = cols[ci].trim()
                if (col === 0) row.name = val
                else if (col === 1) row.email = val
                else if (col - 2 < scoreColCount) row.scores[col - 2] = val
              }
              next[rowIdx] = row
            }
            return next
          })
        })
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, gridRows, preview])

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

  function cs(r: number, c: number): React.CSSProperties {
    return inSel(r, c)
      ? { backgroundColor: 'rgba(11,181,199,0.1)', boxShadow: 'inset 0 0 0 1px rgba(11,181,199,0.45)' }
      : {}
  }

  const effectivePct = exam.passing_pct_override ?? classPassingPct
  const studentNameMap = new Map(classStudents.map(s => [s.name.toLowerCase(), s]))

  function updateCell(rowIdx: number, field: 'name' | 'email', value: string) {
    setGridRows(prev => { const n = [...prev]; n[rowIdx] = { ...n[rowIdx], [field]: value }; return n })
  }

  function updateScore(rowIdx: number, scoreIdx: number, value: string) {
    setGridRows(prev => {
      const n = [...prev]
      const scores = [...n[rowIdx].scores]
      scores[scoreIdx] = value
      n[rowIdx] = { ...n[rowIdx], scores }
      return n
    })
  }

  function handleCellPaste(rowStart: number, colStart: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n') && !text.includes('\t')) return
    e.preventDefault()
    applyPastedText(text, rowStart, colStart)
  }

  function applyPastedText(text: string, rowStart = 0, colStart = 0) {
    const lines = text.split('\n').map(r => r.replace(/\r$/, ''))
    const tableData = lines
      .map(r => r.split('\t').map(c => c.trim()))
      .filter(r => r.some(c => c))
    if (tableData.length === 0) return

    // Auto-skip header row only when pasting from col 0
    let startIdx = 0
    if (colStart === 0) {
      const firstRow = tableData[0]
      if (!firstRow.some(c => c.includes('/')) && tableData.length > 1 &&
          firstRow.some(c => /^(name|student|email|score)/i.test(c))) {
        startIdx = 1
      }
    }
    const dataRows = tableData.slice(startIdx)

    setGridRows(prev => {
      const next = [...prev]
      dataRows.forEach((cols, offset) => {
        const idx = rowStart + offset
        if (idx >= next.length) next.push(makeEmptyRow())
        const scores = [...next[idx].scores]
        for (let ci = 0; ci < cols.length; ci++) {
          const col = colStart + ci
          const val = cols[ci]
          if (col === 0) next[idx] = { ...next[idx], scores, name: val }
          else if (col === 1) next[idx] = { ...next[idx], scores, email: val }
          else if (col - 2 < scoreColCount) scores[col - 2] = val
        }
        next[idx] = { ...next[idx], scores }
      })
      while (next.length < INITIAL_ROWS) next.push(makeEmptyRow())
      return next
    })
  }

  function handlePreview() {
    setError('')
    setTotalWarning('')
    const filledRows = gridRows.filter(r => r.name.trim())
    if (filledRows.length === 0) { setError('No data entered. Fill in rows or paste from a spreadsheet.'); return }

    const parsedRows: PreviewRow[] = []
    for (let i = 0; i < filledRows.length; i++) {
      const row = filledRows[i]
      const parsedBySubject: (ParsedScore | null)[] = Array.from({ length: scoreColCount }, (_, ci) =>
        row.scores[ci]?.trim() ? parseScore(row.scores[ci]) : null
      )

      for (let ci = 0; ci < scoreColCount; ci++) {
        const raw = row.scores[ci]?.trim()
        const label = multiSubject ? (examSubjects[ci]?.name ?? `Subject ${ci + 1}`) : 'Score'
        if (!raw) { setError(`Row ${i + 1}: missing score for "${label}".`); return }
        if (!parsedBySubject[ci]) { setError(`Row ${i + 1}: invalid score for "${label}": "${raw}". Expected: 25 / 50`); return }
      }

      const allParsed = parsedBySubject.filter(Boolean) as ParsedScore[]
      const totalParsed: ParsedScore | null = allParsed.length > 0 ? {
        score: allParsed.reduce((s, p) => s + p.score, 0),
        total: allParsed.reduce((s, p) => s + p.total, 0),
        pct: Math.round(allParsed.reduce((s, p) => s + p.score, 0) / allParsed.reduce((s, p) => s + p.total, 0) * 10000) / 100,
      } : null

      const student = studentNameMap.get(row.name.trim().toLowerCase()) ?? null
      parsedRows.push({ rawName: row.name.trim(), rawEmail: row.email.trim(), parsedBySubject, totalParsed, student, isUnknown: !student })
    }

    if (multiSubject) {
      setTotalWarning(`Scores for ${examSubjects.length} subjects will be summed to compute the total.`)
    } else {
      const totals = new Set(parsedRows.map(r => r.parsedBySubject[0]?.total).filter(Boolean))
      if (totals.size > 1) {
        setTotalWarning(`Different denominators detected: ${[...totals].join(', ')}. Most common will be used.`)
      }
    }

    const defaultActions: Record<number, 'skip' | 'add'> = {}
    parsedRows.forEach((r, i) => { if (r.isUnknown) defaultActions[i] = 'skip' })
    setUnknownActions(defaultActions)
    setPreview(parsedRows)
  }

  async function handleImport() {
    if (!preview) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    const validParsed = preview.filter(r => r.totalParsed).map(r => r.totalParsed!)
    const detectedTotal = detectTotalItems(validParsed)
    const toImport = preview.filter((r, i) => !r.isUnknown || unknownActions[i] === 'add')
    const results: ScoreRow[] = []

    for (const row of toImport) {
      if (!row.totalParsed) continue
      let studentId = row.student?.id

      if (row.isUnknown) {
        const name = row.rawName
        const email = row.rawEmail ? row.rawEmail.toLowerCase() : null
        const { data: newStudent, error: err } = await supabase
          .from('students')
          .insert({ name, school: null, email })
          .select('id').single()
        if (err || !newStudent) { setError(`Failed to add student ${row.rawName}: ${err?.message}`); setLoading(false); return }
        studentId = newStudent.id
        await supabase.from('class_students')
          .upsert({ class_id: classId, student_id: studentId }, { onConflict: 'class_id,student_id' })
      }

      if (!studentId) continue

      // Per-subject breakdown for subject-level analytics
      const subjectScores = multiSubject
        ? (row.parsedBySubject.map((p, ci) => p ? {
            subject_id: examSubjects[ci].id,
            raw_score: p.score,
            total_items: p.total,
          } : null).filter(Boolean) as { subject_id: string; raw_score: number; total_items: number }[])
        : null

      const { data: score, error: err } = await supabase
        .from('scores')
        .upsert(
          {
            exam_id: exam.id,
            student_id: studentId,
            raw_score: row.totalParsed.score,
            total_items: row.totalParsed.total,
            subject_scores: subjectScores?.length ? subjectScores : null,
          },
          { onConflict: 'exam_id,student_id' }
        )
        .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at, subject_scores')
        .single()

      if (err || !score) { setError(`Failed to save score: ${err?.message}`); setLoading(false); return }
      results.push(score as ScoreRow)
    }

    await supabase.from('exams').update({ total_items: detectedTotal }).eq('id', exam.id)
    setLoading(false)
    onImported(results, detectedTotal)
  }

  const importCount = preview
    ? preview.filter((r, i) => !r.isUnknown || unknownActions[i] === 'add').length
    : 0

  const filledCount = gridRows.filter(r => r.name.trim()).length

  return (
    <Modal title={`Import Scores — ${exam.name}`} onClose={onClose} width="2xl">
      {!preview ? (
        <div className="space-y-4">
          {/* Subject tags */}
          {examSubjects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Subjects:</span>
              {examSubjects.map(s => (
                <span key={s.id} className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.2)' }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Type directly or paste a range from Google Sheets / Excel (Name → Email → Scores, tab-separated).
            Score format: <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>25 / 50</code>
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy · Ctrl/Cmd+V to paste
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Spreadsheet grid */}
          <div className="rounded-xl" style={{ border: '1px solid var(--color-border)', maxHeight: 420, overflowX: 'auto', overflowY: 'auto' }}>
            <table className="text-sm border-collapse" style={{ width: '100%', minWidth: `${36 + 140 + 200 + scoreColCount * 130}px` }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)', width: 36, minWidth: 36 }}>
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)', minWidth: 140 }}>
                    Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)', minWidth: 200 }}>
                    Email
                  </th>
                  {examSubjects.length > 0
                    ? examSubjects.map((s, ci) => (
                        <th key={s.id} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)', borderRight: ci < examSubjects.length - 1 ? '1px solid var(--color-border)' : 'none', minWidth: 130 }}>
                          {s.name} <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </th>
                      ))
                    : (
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)', minWidth: 130 }}>
                          Score <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </th>
                      )
                  }
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-3 py-1 text-xs text-center"
                      style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)' }}>
                      {i + 1}
                    </td>
                    <td style={{ borderRight: '1px solid var(--color-border)', padding: 0, ...cs(i, 0) }}
                      onMouseDown={e => cellMouseDown(i, 0, e)}>
                      <input
                        style={cellInputStyle}
                        value={row.name}
                        onChange={e => updateCell(i, 'name', e.target.value)}
                        onPaste={e => handleCellPaste(i, 0, e)}
                        placeholder={i < 2 ? 'Juan Dela Cruz' : ''}
                      />
                    </td>
                    <td style={{ borderRight: '1px solid var(--color-border)', padding: 0, ...cs(i, 1) }}
                      onMouseDown={e => cellMouseDown(i, 1, e)}>
                      <input
                        style={cellInputStyle}
                        value={row.email}
                        onChange={e => updateCell(i, 'email', e.target.value)}
                        onPaste={e => handleCellPaste(i, 1, e)}
                        placeholder={i < 2 ? 'juan@email.com' : ''}
                      />
                    </td>
                    {Array.from({ length: scoreColCount }, (_, ci) => (
                      <td key={ci} style={{ borderRight: ci < scoreColCount - 1 ? '1px solid var(--color-border)' : 'none', padding: 0, ...cs(i, 2 + ci) }}
                        onMouseDown={e => cellMouseDown(i, 2 + ci, e)}>
                        <input
                          style={cellInputStyle}
                          value={row.scores[ci] ?? ''}
                          onChange={e => updateScore(i, ci, e.target.value)}
                          onPaste={e => handleCellPaste(i, 2 + ci, e)}
                          placeholder={i < 2 ? '25 / 50' : ''}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGridRows(prev => [...prev, ...Array.from({ length: 10 }, makeEmptyRow)])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <Plus size={11} /> Add 10 rows
              </button>
              {filledCount > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {filledCount} row{filledCount !== 1 ? 's' : ''} filled
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {onBack ? (
                <button onClick={onBack} className="px-4 py-2 text-sm rounded-xl"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  ← Back
                </button>
              ) : (
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  Cancel
                </button>
              )}
              <button onClick={handlePreview}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#0BB5C7' }}>
                Preview →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} />
              {preview.length} row{preview.length !== 1 ? 's' : ''} parsed
            </div>
            {multiSubject && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                {examSubjects.length} subjects · totals summed
              </span>
            )}
            {preview.some(r => r.isUnknown) && (
              <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
                {preview.filter(r => r.isUnknown).length} unknown student(s)
              </span>
            )}
            <span className="text-sm ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              Passing: {effectivePct}%{exam.passing_pct_override != null ? ' (custom)' : ' (class default)'}
            </span>
          </div>

          {totalWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: 'var(--color-warning)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />{totalWarning}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['#', 'Name', 'Email',
                    ...(multiSubject ? examSubjects.map(s => s.name) : ['Score']),
                    ...(multiSubject ? ['Total'] : []),
                    '%', 'Result', 'Status',
                  ].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const passes = row.totalParsed ? row.totalParsed.pct >= effectivePct : null
                  return (
                    <tr key={i} style={{
                      borderBottom: i < preview.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: row.isUnknown ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {(row.student?.name ?? row.rawName) || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.rawEmail}</td>
                      {multiSubject
                        ? row.parsedBySubject.map((p, ci) => (
                          <td key={ci} className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {p ? `${p.score}/${p.total}` : <span style={{ color: 'var(--color-danger)' }}>—</span>}
                          </td>
                        ))
                        : (
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.totalParsed ? `${row.totalParsed.score} / ${row.totalParsed.total}` : <span style={{ color: 'var(--color-danger)' }}>Invalid</span>}
                          </td>
                        )}
                      {multiSubject && (
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {row.totalParsed ? `${row.totalParsed.score}/${row.totalParsed.total}` : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {row.totalParsed ? `${row.totalParsed.pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {passes !== null && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={passes
                              ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }
                              : { backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                            {passes ? 'Pass' : 'Fail'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.isUnknown ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                              Unknown
                            </span>
                            <select
                              value={unknownActions[i]}
                              onChange={e => setUnknownActions(prev => ({ ...prev, [i]: e.target.value as 'skip' | 'add' }))}
                              className="text-xs outline-none"
                              style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                              <option value="skip">Skip</option>
                              <option value="add">Add student</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
                            Matched
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setPreview(null)} className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              ← Back
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={loading || importCount === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
                style={{ backgroundColor: '#0BB5C7' }}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                Import {importCount} Score{importCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
