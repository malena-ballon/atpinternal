'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { calcMean, calcMedian, calcStdDev } from '../PerformanceInsights'
import type { ExamStats, StudentStats } from '../PerformanceInsights'

interface Props {
  className: string
  examStats: ExamStats[]
  studentStats: StudentStats[]
  classPassingPct: number
}

// Build subject list from examStats (exclude Assessment)
function buildSubjectList(examStats: ExamStats[]) {
  const seen = new Map<string, string>() // name → name (dedup)
  for (const es of examStats) {
    const name = es.exam.subjects?.name
    if (!name || name.toLowerCase() === 'assessment') continue
    seen.set(name, name)
  }
  return Array.from(seen.keys())
}

export default function PerSubjectTab({ examStats, studentStats, classPassingPct }: Props) {
  const subjects = useMemo(() => buildSubjectList(examStats), [examStats])
  const [selected, setSelected] = useState<string>(() => subjects[0] ?? '')

  const subjectExamStats = useMemo(
    () => examStats.filter(es => es.exam.subjects?.name === selected),
    [examStats, selected]
  )

  // Aggregated scores for the selected subject
  const allScores = useMemo(() => subjectExamStats.flatMap(es => es.scores), [subjectExamStats])
  const pcts = useMemo(() => allScores.map(s => s.percentage), [allScores])
  const avg = pcts.length > 0 ? calcMean(pcts) : 0
  const median = pcts.length > 0 ? calcMedian(pcts) : 0
  const stdDev = pcts.length > 0 ? calcStdDev(pcts) : 0
  const passCount = allScores.filter(s => s.percentage >= classPassingPct).length
  const passRate = allScores.length > 0 ? (passCount / allScores.length) * 100 : 0

  // Per-exam trend for this subject (avg over time)
  const trendData = useMemo(() =>
    subjectExamStats.map(es => ({
      name: es.exam.name.length > 18 ? es.exam.name.slice(0, 16) + '…' : es.exam.name,
      fullName: es.exam.name,
      avg: parseFloat(es.avg.toFixed(1)),
      passRate: es.scores.length > 0 ? parseFloat((es.passCount / es.scores.length * 100).toFixed(1)) : 0,
    })),
    [subjectExamStats]
  )

  // Per-student average for this subject
  const studentSubjectStats = useMemo(() => {
    return studentStats.map(st => {
      const scores = st.scores.filter(s => {
        const es = subjectExamStats.find(e => e.exam.id === s.exam_id)
        return !!es
      })
      const spcts = scores.map(s => s.percentage)
      return {
        name: st.student.name,
        id: st.student.id,
        avg: spcts.length > 0 ? calcMean(spcts) : null,
        examsTaken: scores.length,
      }
    }).filter(s => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)) as {
      name: string; id: string; avg: number; examsTaken: number
    }[]
  }, [studentStats, subjectExamStats])

  if (subjects.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No subject data available. Assign subjects to exams (excluding Assessment).
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {/* Subject selector */}
      <div className="flex flex-wrap gap-2">
        {subjects.map(s => (
          <button
            key={s}
            onClick={() => setSelected(s)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={selected === s
              ? { backgroundColor: '#0BB5C7', color: '#fff' }
              : { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            {s}
          </button>
        ))}
      </div>

      {subjectExamStats.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No exam data for {selected}.</p>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Avg Score', value: `${avg.toFixed(1)}%`, accent: avg >= classPassingPct },
              { label: 'Median', value: `${median.toFixed(1)}%`, accent: false },
              { label: 'Std Dev', value: `±${stdDev.toFixed(1)}%`, accent: false },
              { label: 'Pass Rate', value: `${passRate.toFixed(0)}%`, accent: passRate >= 60 },
              { label: 'Scores', value: `${allScores.length}`, accent: false },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl p-4 text-center"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-xl font-bold" style={{ color: kpi.accent ? '#0BB5C7' : 'var(--color-text-primary)' }}>
                  {kpi.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Avg score trend */}
            {trendData.length > 1 && (
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Average Score Over Exams
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-border)" />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} stroke="var(--color-border)" />
                    <Tooltip
                      formatter={(v: any) => [`${v}%`]}
                      labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ''}
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="avg" stroke="#0BB5C7" strokeWidth={2} dot={{ r: 4, fill: '#0BB5C7' }} name="Avg" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pass rate trend */}
            {trendData.length > 1 && (
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Pass Rate Over Exams
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-border)" />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} stroke="var(--color-border)" />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, 'Pass Rate']}
                      labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ''}
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                    />
                    <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
                      {trendData.map((d, i) => (
                        <Cell key={i} fill={d.passRate >= 60 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Exam-by-exam breakdown */}
          <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Exam Breakdown</p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Exam', 'Avg', 'Median', 'Std Dev', 'Pass Rate', 'Highest', 'Lowest', 'Students'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjectExamStats.map((es, i) => {
                    const pr = es.scores.length > 0 ? (es.passCount / es.scores.length * 100) : 0
                    return (
                      <tr key={es.exam.id} style={{ borderBottom: i < subjectExamStats.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td className="px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--color-text-primary)', maxWidth: 160 }}>
                          {es.exam.name}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: es.avg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>
                          {es.avg.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                          {es.median.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          ±{es.stdDev.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: pr >= 60 ? '#22c55e' : '#ef4444' }}>
                          {pr.toFixed(0)}%
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {es.highest ? `${es.highest.name} (${es.highest.pct.toFixed(0)}%)` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {es.lowest ? `${es.lowest.name} (${es.lowest.pct.toFixed(0)}%)` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {es.scores.length}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top & bottom students */}
          {studentSubjectStats.length > 0 && (
            <div className="grid grid-cols-2 gap-5">
              {/* Top performers */}
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Top Performers — {selected}
                </p>
                <div className="space-y-2">
                  {studentSubjectStats.slice(0, 8).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs w-5 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
                      <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                      <span className="text-xs font-mono font-medium" style={{ color: s.avg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>
                        {s.avg.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs attention */}
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Needs Attention — {selected}
                </p>
                <div className="space-y-2">
                  {[...studentSubjectStats].reverse().slice(0, 8).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs w-5 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {studentSubjectStats.length - i}
                      </span>
                      <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                      <span className="text-xs font-mono font-medium" style={{ color: s.avg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>
                        {s.avg.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
