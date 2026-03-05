'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ordinal } from '../PerformanceInsights'
import type { StudentStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'

interface Props {
  className: string
  studentStats: StudentStats[]
  totalExams: number
  totalStudents: number
  classPassingPct: number
}

function TrendLabel({ trend }: { trend: 'improving' | 'steady' | 'declining' }) {
  if (trend === 'improving') return <span style={{ color: 'var(--color-success)' }}>↑ Improving</span>
  if (trend === 'declining') return <span style={{ color: 'var(--color-danger)' }}>↓ Declining</span>
  return <span style={{ color: 'var(--color-text-muted)' }}>→ Steady</span>
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  width: '100%',
  maxWidth: 360,
  outline: 'none',
}

export default function PerStudentTab({ className, studentStats, totalExams, totalStudents, classPassingPct }: Props) {
  const [selectedId, setSelectedId] = useState<string>(studentStats[0]?.student.id ?? '')
  const stats = studentStats.find(s => s.student.id === selectedId)

  async function handleExport() {
    if (!stats) return
    const { pdf } = await import('@react-pdf/renderer')
    const { default: StudentReportPDF } = await import('../pdf/StudentReportPDF')
    const blob = await pdf(
      <StudentReportPDF
        className={className}
        stats={stats}
        totalStudents={totalStudents}
        totalExams={totalExams}
        classPassingPct={classPassingPct}
      />
    ).toBlob()
    const safeName = stats.student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
    downloadBlob(blob, pdfFileName(`${className}_${safeName}`, 'Student-Report'))
  }

  const trendData = stats?.scores.map(s => ({
    name: s.exam.name,
    pct: parseFloat(s.percentage.toFixed(1)),
  })) ?? []

  return (
    <div className="space-y-4">
      {/* Selector + export */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Select Student</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={selectStyle}>
            {studentStats.map(s => (
              <option key={s.student.id} value={s.student.id}>
                {s.student.name} — {s.avgPct.toFixed(1)}% avg
              </option>
            ))}
          </select>
        </div>
        {stats && <ExportButton onExport={handleExport} label="Export Student Report" />}
      </div>

      {!stats && (
        <p className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>No students found.</p>
      )}

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Overall Avg', value: stats.avgPct.toFixed(1) + '%' },
              { label: 'Class Rank', value: `${ordinal(stats.rank)} of ${studentStats.length}` },
              { label: 'Percentile', value: ordinal(stats.percentile) },
              { label: 'Exams Taken', value: `${stats.examsTaken} / ${totalExams}` },
            ].map(card => (
              <div key={card.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{card.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Trend + High + Low */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Performance Trend</div>
              <div className="text-sm font-semibold mt-1"><TrendLabel trend={stats.trend} /></div>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Highest Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                {stats.highest ? `${stats.highest.pct.toFixed(1)}%` : '—'}
              </div>
              {stats.highest && (
                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{stats.highest.exam.name}</div>
              )}
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Lowest Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--color-danger)' }}>
                {stats.lowest ? `${stats.lowest.pct.toFixed(1)}%` : '—'}
              </div>
              {stats.lowest && (
                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{stats.lowest.exam.name}</div>
              )}
            </div>
          </div>

          {/* Trend chart */}
          {trendData.length >= 2 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Performance Trend</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, 'Score']}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#0BB5C7" strokeWidth={2} dot={{ r: 3, fill: '#0BB5C7' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Score per exam table */}
          {stats.scores.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Score Per Exam</h3>
              <CopyableTable
                headers={['Exam', 'Score', '%', 'Result']}
                rows={stats.scores.map(s => {
                  const effectivePassing = s.exam.passing_pct_override ?? classPassingPct
                  const passes = s.percentage >= effectivePassing
                  return [
                    { display: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.exam.name}</span>, copy: s.exam.name },
                    { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.raw_score} / {s.total_items}</span>, copy: `${s.raw_score} / ${s.total_items}` },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{s.percentage.toFixed(1)}%</span>, copy: s.percentage.toFixed(1) + '%' },
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
          ) : (
            <p className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No scores recorded for this student yet.
            </p>
          )}
        </>
      )}
    </div>
  )
}
