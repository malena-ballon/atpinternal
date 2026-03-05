'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import type { SchoolStats, ExamRow } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'

interface Props {
  className: string
  schoolStats: SchoolStats[]
  sortedExams: ExamRow[]
}

const COLORS = ['#0BB5C7', '#22c55e', '#f59e0b', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#84cc16']

export default function PerSchoolTab({ className, schoolStats, sortedExams }: Props) {
  async function handleExport() {
    const { pdf } = await import('@react-pdf/renderer')
    const { default: SchoolReportPDF } = await import('../pdf/SchoolReportPDF')
    const blob = await pdf(
      <SchoolReportPDF className={className} schoolStats={schoolStats} sortedExams={sortedExams} />
    ).toBlob()
    downloadBlob(blob, pdfFileName(className, 'School-Report'))
  }
  if (schoolStats.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No school data available.
      </p>
    )
  }

  const schoolBarData = schoolStats.map(s => ({
    name: s.school,
    avg: parseFloat(s.avgPct.toFixed(1)),
    count: s.students.length,
  }))

  // Build trend data: one entry per exam, one key per school
  const trendData = sortedExams.map((exam, ei) => {
    const row: Record<string, number | string> = { name: exam.name }
    for (const school of schoolStats) {
      row[school.school] = parseFloat((school.examTrend[ei]?.avg ?? 0).toFixed(1))
    }
    return row
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <ExportButton onExport={handleExport} label="Export School Report" />
      </div>

      {/* Top school callout */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: 'rgba(11,181,199,0.06)', border: '1px solid rgba(11,181,199,0.2)' }}
      >
        <div className="text-xs font-medium mb-0.5" style={{ color: '#0BB5C7' }}>Top-Performing School</div>
        <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{schoolStats[0].school}</div>
        <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {schoolStats[0].avgPct.toFixed(1)}% avg · {schoolStats[0].students.length} student{schoolStats[0].students.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Average score by school — horizontal bar chart */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Average Score by School</h3>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <ResponsiveContainer width="100%" height={Math.max(120, schoolStats.length * 44)}>
            <BarChart data={schoolBarData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, _name, payload) => [`${v}% avg (${payload.payload.count} students)`, '']}
              />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {schoolBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* School trend over time — line chart */}
      {sortedExams.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>School Performance Trend</h3>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`${v}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
                {schoolStats.map((s, i) => (
                  <Line
                    key={s.school}
                    type="monotone"
                    dataKey={s.school}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* School representation table */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>School Representation</h3>
        <CopyableTable
          headers={['Rank', 'School', 'Students', 'Avg Score']}
          rows={schoolStats.map((s, i) => [
            { display: <span style={{ color: i === 0 ? '#0BB5C7' : 'var(--color-text-muted)', fontWeight: 700 }}>{i + 1}</span>, copy: String(i + 1) },
            { display: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.school}</span>, copy: s.school },
            { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.students.length}</span>, copy: String(s.students.length) },
            { display: <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{s.avgPct.toFixed(1)}%</span>, copy: s.avgPct.toFixed(1) + '%' },
          ])}
        />
      </div>
    </div>
  )
}
