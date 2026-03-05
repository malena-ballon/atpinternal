'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ordinal } from '../PerformanceInsights'
import type { ExamStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'

interface Props {
  className: string
  examStats: ExamStats[]
  classPassingPct: number
}

const DIST_COLORS = ['#22c55e', '#0BB5C7', '#f59e0b', '#f97316', '#ef4444']

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  width: '100%',
  maxWidth: 420,
  outline: 'none',
}

export default function PerExamTab({ className, examStats, classPassingPct }: Props) {
  const [selectedId, setSelectedId] = useState<string>(examStats[0]?.exam.id ?? '')
  const stats = examStats.find(s => s.exam.id === selectedId)

  async function handleExport() {
    if (!stats) return
    const { pdf } = await import('@react-pdf/renderer')
    const { default: ExamReportPDF } = await import('../pdf/ExamReportPDF')
    const blob = await pdf(
      <ExamReportPDF className={className} stats={stats} classPassingPct={classPassingPct} />
    ).toBlob()
    const safeName = stats.exam.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
    downloadBlob(blob, pdfFileName(`${className}_${safeName}`, 'Exam-Report'))
  }

  const effectivePassing = stats ? (stats.exam.passing_pct_override ?? classPassingPct) : classPassingPct

  // Compute percentile rank per student within this exam
  const sortedByPct = useMemo(() => {
    if (!stats) return []
    return [...stats.scores].sort((a, b) => b.percentage - a.percentage)
  }, [stats])

  const percentileMap = useMemo(() => {
    if (!stats) return new Map<string, number>()
    const total = stats.scores.length
    return new Map(stats.scores.map(s => {
      const countLowerOrEqual = stats.scores.filter(x => x.percentage <= s.percentage).length
      return [s.id, Math.round((countLowerOrEqual / total) * 100)]
    }))
  }, [stats])

  const passRate = stats && stats.scores.length > 0
    ? Math.round((stats.passCount / stats.scores.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Selector + export */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Select Exam</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={selectStyle}>
            {examStats.map(s => (
              <option key={s.exam.id} value={s.exam.id}>{s.exam.name}</option>
            ))}
          </select>
        </div>
        {stats && <ExportButton onExport={handleExport} label="Export Exam Report" />}
      </div>

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Class Avg', value: stats.avg.toFixed(1) + '%' },
              { label: 'Median', value: stats.median.toFixed(1) + '%' },
              { label: 'Std Dev', value: '±' + stats.stdDev.toFixed(1) + '%' },
              { label: 'Perfect Scores', value: stats.perfectCount },
            ].map(card => (
              <div key={card.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{card.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Pass/Fail + Highest + Lowest */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Pass / Fail · passing {effectivePassing}%</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{stats.passCount}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>passed</span>
                <span className="text-lg font-bold ml-2" style={{ color: 'var(--color-danger)' }}>{stats.failCount}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>failed</span>
              </div>
              {stats.scores.length > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{passRate}% pass rate</div>
              )}
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Highest Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                {stats.highest ? `${stats.highest.pct.toFixed(1)}%` : '—'}
              </div>
              {stats.highest && <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{stats.highest.name}</div>}
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Lowest Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--color-danger)' }}>
                {stats.lowest ? `${stats.lowest.pct.toFixed(1)}%` : '—'}
              </div>
              {stats.lowest && <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{stats.lowest.name}</div>}
            </div>
          </div>

          {/* Score distribution histogram */}
          {stats.scores.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Score Distribution</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.distribution} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="bracket" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [v, 'Students']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.distribution.map((_, i) => <Cell key={i} fill={DIST_COLORS[i] ?? '#0BB5C7'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Score table with percentile column */}
          {sortedByPct.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Student Scores &amp; Percentile Ranks</h3>
              <CopyableTable
                headers={['#', 'Student', 'Score', '%', 'Percentile', 'Result']}
                rows={sortedByPct.map((s, i) => {
                  const passes = s.percentage >= effectivePassing
                  const pct = percentileMap.get(s.id) ?? 0
                  return [
                    { display: <span style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>, copy: String(i + 1) },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.students?.name ?? '—'}</span>, copy: s.students?.name ?? '—' },
                    { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.raw_score} / {s.total_items}</span>, copy: `${s.raw_score} / ${s.total_items}` },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{s.percentage.toFixed(1)}%</span>, copy: s.percentage.toFixed(1) + '%' },
                    { display: <span style={{ color: 'var(--color-text-muted)' }}>{ordinal(pct)}</span>, copy: ordinal(pct) },
                    {
                      display: <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={passes ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' } : { backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                        {passes ? 'Pass' : 'Fail'}
                      </span>,
                      copy: passes ? 'Pass' : 'Fail',
                    },
                  ]
                })}
              />
            </div>
          )}

          {stats.scores.length === 0 && (
            <p className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>No scores imported for this exam yet.</p>
          )}
        </>
      )}
    </div>
  )
}
