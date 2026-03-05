'use client'

import { useState, useEffect } from 'react'
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { ExamRow, ScoreRow } from '@/types'

type SortCol = 'name' | 'pct' | 'score'

interface Props {
  exam: ExamRow
  classPassingPct: number
  externalScores?: ScoreRow[] | null // if provided by parent after import, skip fetch
}

export default function ExamScoresTable({ exam, classPassingPct, externalScores }: Props) {
  const [scores, setScores] = useState<ScoreRow[] | null>(externalScores ?? null)
  const [loading, setLoading] = useState(!externalScores)
  const [sortCol, setSortCol] = useState<SortCol>('pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const effectivePct = exam.passing_pct_override ?? classPassingPct
  const isCustom = exam.passing_pct_override != null

  useEffect(() => {
    if (externalScores) { setScores(externalScores); setLoading(false); return }
    const supabase = createClient()
    supabase.from('scores')
      .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at, students(name, email)')
      .eq('exam_id', exam.id)
      .then(({ data }) => {
        setScores((data ?? []) as unknown as ScoreRow[])
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'pct' ? 'desc' : 'asc') }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronUp size={11} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin" style={{ color: '#0BB5C7' }} />
      </div>
    )
  }

  if (!scores || scores.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No scores imported yet. Click "Import Scores" to add.
      </p>
    )
  }

  const sorted = [...scores].sort((a, b) => {
    let va: number, vb: number
    if (sortCol === 'name') {
      const na = (a.students?.name ?? '').toLowerCase()
      const nb = (b.students?.name ?? '').toLowerCase()
      return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na)
    }
    va = sortCol === 'pct' ? a.percentage : a.raw_score
    vb = sortCol === 'pct' ? b.percentage : b.raw_score
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const passCount = scores.filter(s => s.percentage >= effectivePct).length
  const failCount = scores.length - passCount
  const avgPct = scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Passing: <strong style={{ color: 'var(--color-text-primary)' }}>{effectivePct}%</strong>
          <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>
            ({isCustom ? 'custom override' : 'class default'})
          </span>
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Avg: <strong style={{ color: 'var(--color-text-primary)' }}>{avgPct.toFixed(1)}%</strong>
        </span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
          {passCount} passed
        </span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
          {failCount} failed
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {scores.length} total
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-8"
                style={{ color: 'var(--color-text-muted)' }}>#</th>
              {([
                { col: 'name' as SortCol, label: 'Student' },
                { col: 'score' as SortCol, label: 'Score' },
                { col: 'pct' as SortCol, label: '%' },
              ]).map(({ col, label }) => (
                <th key={col} className="px-3 py-2.5 text-left"
                  style={{ color: 'var(--color-text-muted)' }}>
                  <button
                    onClick={() => handleSort(col)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:opacity-80">
                    {label} <SortIcon col={col} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}>Result</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const passes = s.percentage >= effectivePct
              return (
                <tr key={s.id} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-3 py-2.5 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {s.students?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {s.raw_score} / {s.total_items}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(s.percentage, 100)}%`,
                            backgroundColor: passes ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {s.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={passes
                        ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }
                        : { backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }
                      }>
                      {passes ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {s.students?.email ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
