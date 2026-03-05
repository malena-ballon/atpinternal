'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { calcMean, ordinal } from '../PerformanceInsights'
import type { StudentStats, ExamStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'

interface Props {
  className: string
  classOverTime: { name: string; avg: number }[]
  studentStats: StudentStats[]
  classPassingPct: number
  atRiskThreshold: number
  totalStudents: number
  totalExams: number
  examStats: ExamStats[]
}

export default function OverallTab({ className, classOverTime, studentStats, classPassingPct, atRiskThreshold, totalStudents, totalExams, examStats }: Props) {
  async function handleExport() {
    const { pdf } = await import('@react-pdf/renderer')
    const { default: ClassReportPDF } = await import('../pdf/ClassReportPDF')
    const blob = await pdf(
      <ClassReportPDF
        className={className}
        classOverTime={classOverTime}
        studentStats={studentStats}
        examStats={examStats}
        classPassingPct={classPassingPct}
        totalStudents={totalStudents}
        totalExams={totalExams}
      />
    ).toBlob()
    downloadBlob(blob, pdfFileName(className, 'Class-Report'))
  }

  const atRisk = studentStats.filter(s => s.avgPct < atRiskThreshold)
  const top10 = studentStats.slice(0, 10)

  const mostImproved = studentStats
    .filter(s => s.scores.length >= 2)
    .map(s => ({ ...s, delta: s.scores[s.scores.length - 1].percentage - s.scores[0].percentage }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)

  // Subject breakdown
  const subjectMap = new Map<string, number[]>()
  for (const es of examStats) {
    const subj = es.exam.subjects?.name ?? 'No Subject'
    if (!subjectMap.has(subj)) subjectMap.set(subj, [])
    if (es.avg > 0) subjectMap.get(subj)!.push(es.avg)
  }
  const subjectData = Array.from(subjectMap.entries())
    .map(([name, avgs]) => ({ name, avg: parseFloat(calcMean(avgs).toFixed(1)) }))
    .sort((a, b) => b.avg - a.avg)

  // Attendance rate
  const totalPossible = totalStudents * totalExams
  const totalTaken = studentStats.reduce((s, st) => s + st.examsTaken, 0)
  const attendanceRate = totalPossible > 0 ? ((totalTaken / totalPossible) * 100).toFixed(1) : '—'

  const overallAvg = classOverTime.length > 0
    ? calcMean(classOverTime.map(x => x.avg)).toFixed(1)
    : '—'

  const CYAN = '#0BB5C7'

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <ExportButton onExport={handleExport} label="Export Class Report" />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Class Size', value: totalStudents },
          { label: 'Total Exams', value: totalExams },
          { label: 'Overall Avg', value: overallAvg + '%' },
          { label: 'Attendance Rate', value: attendanceRate + '%' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Class avg over time */}
      {classOverTime.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Class Average Over Time</h3>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={classOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Avg']}
                />
                <Line type="monotone" dataKey="avg" stroke={CYAN} strokeWidth={2} dot={{ r: 3, fill: CYAN }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject breakdown */}
        {subjectData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Subject Breakdown</h3>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <ResponsiveContainer width="100%" height={Math.max(120, subjectData.length * 40)}>
                <BarChart data={subjectData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Avg']}
                  />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {subjectData.map((_, i) => <Cell key={i} fill={CYAN} fillOpacity={0.75 + (i === 0 ? 0.25 : 0)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Most improved */}
        {mostImproved.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Most Improved</h3>
            <CopyableTable
              headers={['Student', 'Change']}
              rows={mostImproved.map(s => [
                { display: <span style={{ color: 'var(--color-text-primary)' }}>{s.student.name}</span>, copy: s.student.name },
                {
                  display: <span style={{ color: s.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'monospace', fontWeight: 600 }}>
                    {s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)}%
                  </span>,
                  copy: (s.delta >= 0 ? '+' : '') + s.delta.toFixed(1) + '%',
                },
              ])}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top performers leaderboard */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Top Performers</h3>
          {top10.length === 0
            ? <p className="text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>No scores yet</p>
            : <CopyableTable
                headers={['Rank', 'Student', 'Avg %', 'Percentile']}
                rows={top10.map((s, i) => [
                  { display: <span style={{ color: i < 3 ? CYAN : 'var(--color-text-muted)', fontWeight: 700 }}>{i + 1}</span>, copy: String(i + 1) },
                  { display: <span style={{ color: 'var(--color-text-primary)' }}>{s.student.name}</span>, copy: s.student.name },
                  { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{s.avgPct.toFixed(1)}%</span>, copy: s.avgPct.toFixed(1) + '%' },
                  { display: <span style={{ color: 'var(--color-text-muted)' }}>{ordinal(s.percentile)}</span>, copy: ordinal(s.percentile) },
                ])}
              />
          }
        </div>

        {/* At-risk students */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            At-Risk Students
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
              (avg &lt; {atRiskThreshold}%)
            </span>
          </h3>
          {atRisk.length === 0
            ? <p className="text-xs px-1" style={{ color: 'var(--color-success)' }}>All students above at-risk threshold</p>
            : <CopyableTable
                headers={['Student', 'Avg %', 'Percentile']}
                rows={atRisk.map(s => [
                  { display: <span style={{ color: 'var(--color-text-primary)' }}>{s.student.name}</span>, copy: s.student.name },
                  { display: <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontFamily: 'monospace' }}>{s.avgPct.toFixed(1)}%</span>, copy: s.avgPct.toFixed(1) + '%' },
                  { display: <span style={{ color: 'var(--color-text-muted)' }}>{ordinal(s.percentile)}</span>, copy: ordinal(s.percentile) },
                ])}
              />
          }
        </div>
      </div>
    </div>
  )
}
