'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, ChevronUp, ChevronDown, Pencil } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { ExamRow, ScoreRow, StudentRow, SubjectRow } from '@/types'
import BulkScoreModal from './BulkScoreModal'

type SortCol = 'name' | 'pct' | 'score'
interface Sel { r1: number; r2: number; c1: number; c2: number }

interface Props {
  exam: ExamRow
  classPassingPct: number
  classId: string
  className: string
  classStudents: StudentRow[]
  subjects: SubjectRow[]
  externalScores?: ScoreRow[] | null
}

export default function ExamScoresTable({ exam, classPassingPct, classId, className, classStudents, subjects, externalScores }: Props) {
  const [scores, setScores] = useState<ScoreRow[] | null>(externalScores ?? null)
  const [loading, setLoading] = useState(!externalScores)
  const [sortCol, setSortCol] = useState<SortCol>('pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEdit, setShowEdit] = useState(false)
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)

  const effectivePct = exam.passing_pct_override ?? classPassingPct
  const isCustom = exam.passing_pct_override != null

  const sorted = useMemo(() => {
    if (!scores || scores.length === 0) return []
    return [...scores].sort((a, b) => {
      if (sortCol === 'name') {
        const na = (a.students?.name ?? '').toLowerCase()
        const nb = (b.students?.name ?? '').toLowerCase()
        return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na)
      }
      const va = sortCol === 'pct' ? a.percentage : a.raw_score
      const vb = sortCol === 'pct' ? b.percentage : b.raw_score
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [scores, sortCol, sortDir])

  useEffect(() => {
    if (externalScores) { setScores(externalScores); setLoading(false); return }
    createClient().from('scores')
      .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at, subject_scores, students(name, email)')
      .eq('exam_id', exam.id)
      .then(({ data }) => { setScores((data ?? []) as unknown as ScoreRow[]); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id])

  // Ctrl+C copy
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'c' || !sel || sorted.length === 0) return
      const el = document.activeElement
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart !== el.selectionEnd) return
      e.preventDefault()
      const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)]
      const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)]
      const text = sorted.slice(r1, r2 + 1)
        .map(row => Array.from({ length: c2 - c1 + 1 }, (_, i) => {
          const c = c1 + i
          if (c === 0) return row.students?.name ?? '—'
          if (c === 1) return `${row.raw_score}/${row.total_items}`
          if (c === 2) return row.percentage.toFixed(1) + '%'
          if (c === 3) return row.percentage >= effectivePct ? 'Pass' : 'Fail'
          if (c === 4) return row.students?.email ?? '—'
          return ''
        }).join('\t'))
        .join('\n')
      navigator.clipboard.writeText(text)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [sel, sorted, effectivePct])

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

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'pct' ? 'desc' : 'asc') }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: '#0BB5C7' }} />
    </div>
  )

  if (!scores || scores.length === 0) return (
    <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
      No scores imported yet. Click &quot;Import Scores&quot; to add.
    </p>
  )

  const passCount = scores.filter(s => s.percentage >= effectivePct).length
  const failCount = scores.length - passCount
  const avgPct = scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length

  function SortBtn({ col, label }: { col: SortCol; label: string }) {
    const active = sortCol === col
    return (
      <button onClick={() => handleSort(col)} className="flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded"
        style={{ color: active ? '#0BB5C7' : 'var(--color-text-muted)', backgroundColor: active ? 'rgba(11,181,199,0.08)' : 'transparent' }}>
        {label} {active ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ChevronUp size={10} style={{ opacity: 0.3 }} />}
      </button>
    )
  }

  // Build initialRows for BulkScoreModal pre-filled with existing scores.
  // For multi-subject exams, map per-subject scores in the correct column order.
  const examSubjectIds = exam.subject_ids?.length ? exam.subject_ids
    : exam.subject_id ? [exam.subject_id] : []
  const editInitialRows = sorted.map(s => {
    let scores: string[]
    if (examSubjectIds.length > 1 && s.subject_scores?.length) {
      scores = examSubjectIds.map(subjId => {
        const ss = s.subject_scores?.find(x => x.subject_id === subjId)
        return ss ? `${ss.raw_score}/${ss.total_items}` : ''
      })
    } else {
      scores = [`${s.raw_score}/${s.total_items}`]
    }
    return { name: s.students?.name ?? '', email: s.students?.email ?? '', scores }
  })

  return (
    <div className="space-y-3">
      {/* Summary + controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Passing: <strong style={{ color: 'var(--color-text-primary)' }}>{effectivePct}%</strong>
          <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>({isCustom ? 'custom override' : 'class default'})</span>
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Avg: <strong style={{ color: 'var(--color-text-primary)' }}>{avgPct.toFixed(1)}%</strong>
        </span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
          {passCount} passed
        </span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
          {failCount} failed
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{scores.length} total</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Sort: <SortBtn col="name" label="Name" /><SortBtn col="score" label="Score" /><SortBtn col="pct" label="%" />
          </div>
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg)' }}>
            <Pencil size={12} /> Edit Scores
          </button>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy
      </p>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-8" style={{ color: 'var(--color-text-muted)' }}>#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Student</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Score</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>%</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Result</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const passes = s.percentage >= effectivePct
              return (
                <tr key={s.id} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-3 py-2.5 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)', cursor: 'cell', ...cs(i, 0) }}
                    onMouseDown={e => cellMouseDown(i, 0, e)}>
                    {s.students?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--color-text-primary)', cursor: 'cell', ...cs(i, 1) }}
                    onMouseDown={e => cellMouseDown(i, 1, e)}>
                    {s.raw_score} / {s.total_items}
                  </td>
                  <td className="px-3 py-2.5" style={{ cursor: 'cell', ...cs(i, 2) }}
                    onMouseDown={e => cellMouseDown(i, 2, e)}>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(s.percentage, 100)}%`, backgroundColor: passes ? 'var(--color-success)' : 'var(--color-danger)' }} />
                      </div>
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5" style={{ cursor: 'cell', ...cs(i, 3) }}
                    onMouseDown={e => cellMouseDown(i, 3, e)}>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={passes
                        ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }
                        : { backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                      {passes ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)', cursor: 'cell', ...cs(i, 4) }}
                    onMouseDown={e => cellMouseDown(i, 4, e)}>
                    {s.students?.email ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <BulkScoreModal
          exam={exam}
          classId={classId}
          className={className}
          classStudents={classStudents}
          classPassingPct={classPassingPct}
          subjects={subjects}
          initialRows={editInitialRows}
          onClose={() => setShowEdit(false)}
          onImported={(newScores) => {
            setScores(prev => {
              if (!prev) return newScores
              const map = new Map(newScores.map(s => [s.student_id, s]))
              return prev.map(s => map.has(s.student_id) ? map.get(s.student_id)! : s)
            })
            setShowEdit(false)
          }}
        />
      )}
    </div>
  )
}
