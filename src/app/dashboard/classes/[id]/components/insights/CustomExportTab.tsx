'use client'

import { useState } from 'react'
import { Loader2, Download, CheckSquare, Square } from 'lucide-react'
import type { StudentStats, ExamStats, SchoolStats } from '../PerformanceInsights'
import { calcMean } from '../PerformanceInsights'
import type { ExamRow } from '@/types'

interface Props {
  className: string
  classPassingPct: number
  classOverTime: { name: string; avg: number }[]
  studentStats: StudentStats[]
  examStats: ExamStats[]
  schoolStats: SchoolStats[]
  sortedExams: ExamRow[]
}

interface Insight {
  id: string
  label: string
  description: string
}

const INSIGHTS: Insight[] = [
  {
    id: 'overall',
    label: 'Overall Class Insight',
    description: 'Class summary stats, performance trend over exams, student rankings, and exam overview.',
  },
  {
    id: 'student',
    label: 'Per Student Insight',
    description: 'Full ranked list of all students with avg score, exams taken, and trend.',
  },
  {
    id: 'exam',
    label: 'Per Exam Insight',
    description: 'Per-exam table with average, median, std dev, pass rate, highest, and lowest scorer.',
  },
  {
    id: 'subject',
    label: 'Per Subject Insight',
    description: 'Avg scores and pass rates grouped by subject (excludes Assessment).',
  },
  {
    id: 'school',
    label: 'Per School Insight',
    description: 'Avg score and student count grouped by school.',
  },
]

export default function CustomExportTab({
  className,
  classPassingPct,
  classOverTime,
  studentStats,
  examStats,
  schoolStats,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(INSIGHTS.map(i => i.id)))
  const [exporting, setExporting] = useState(false)

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleExport() {
    if (selected.size === 0) return
    setExporting(true)
    try {
      const { pdf, Document, Page, View, Text, StyleSheet } = await import('@react-pdf/renderer')
      const React = await import('react')

      const C = { navy: '#0A1045', cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB' }

      const s = StyleSheet.create({
        page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
        brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
        docTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 2 },
        subtitle: { fontSize: 10, color: C.mid, marginBottom: 4 },
        genDate: { fontSize: 7, color: C.muted },
        divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 14 },
        insightTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4, marginTop: 14 },
        insightDesc: { fontSize: 8, color: C.muted, marginBottom: 10 },
        th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
        td: { fontSize: 8, color: C.mid },
        tdDark: { fontSize: 8, color: C.dark, fontFamily: 'Helvetica-Bold' },
        headerRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F3F4F6', borderRadius: 4 },
        row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
        rowAlt: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.altRow },
        statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
        statBox: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' },
        statVal: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 2 },
        statLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
        footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
        footerText: { fontSize: 7, color: C.muted },
      })

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const allPcts = studentStats.map(st => st.avgPct)
      const overallAvg = allPcts.length > 0 ? calcMean(allPcts) : 0
      const passingStudents = studentStats.filter(st => st.avgPct >= classPassingPct).length

      // ── Section builders ────────────────────────────────────────────────────

      function overallSection() {
        return [
          React.createElement(Text, { style: s.insightTitle }, 'Overall Class Insight'),
          React.createElement(Text, { style: s.insightDesc }, 'Key metrics, performance trend, and ranked student summary.'),

          // KPI stats
          React.createElement(View, { style: s.statRow },
            ...[
              { val: `${overallAvg.toFixed(1)}%`, label: 'Class Avg' },
              { val: `${passingStudents}/${studentStats.length}`, label: 'Passing' },
              { val: `${examStats.length}`, label: 'Total Exams' },
              { val: `${classPassingPct}%`, label: 'Pass Threshold' },
            ].map((kpi, i) =>
              React.createElement(View, { key: `overall-kpi-${i}`, style: s.statBox },
                React.createElement(Text, { style: s.statVal }, kpi.val),
                React.createElement(Text, { style: s.statLabel }, kpi.label),
              )
            )
          ),

          // Trend table
          React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.mid, marginBottom: 4 } }, 'Performance Trend'),
          React.createElement(View, { style: s.headerRow },
            React.createElement(Text, { style: [s.th, { flex: 3 }] }, 'Exam'),
            React.createElement(Text, { style: [s.th, { width: 70 }] }, 'Class Avg'),
          ),
          ...classOverTime.map((r, i) =>
            React.createElement(View, { key: `overall-trend-${i}`, style: i % 2 === 0 ? s.row : s.rowAlt },
              React.createElement(Text, { style: [s.td, { flex: 3 }] }, r.name),
              React.createElement(Text, { style: [s.tdDark, { width: 70 }] }, `${r.avg.toFixed(1)}%`),
            )
          ),
        ]
      }

      function studentSection() {
        return [
          React.createElement(Text, { style: s.insightTitle }, 'Per Student Insight'),
          React.createElement(Text, { style: s.insightDesc }, 'All students ranked by average score across all exams.'),
          React.createElement(View, { style: s.headerRow },
            React.createElement(Text, { style: [s.th, { width: 28 }] }, '#'),
            React.createElement(Text, { style: [s.th, { flex: 2 }] }, 'Student'),
            React.createElement(Text, { style: [s.th, { width: 65 }] }, 'Avg Score'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Exams Taken'),
            React.createElement(Text, { style: [s.th, { width: 65 }] }, 'Trend'),
            React.createElement(Text, { style: [s.th, { width: 65 }] }, 'Result'),
          ),
          ...studentStats.map((st, i) =>
            React.createElement(View, { key: `student-${i}`, style: i % 2 === 0 ? s.row : s.rowAlt },
              React.createElement(Text, { style: [s.td, { width: 28 }] }, `${i + 1}`),
              React.createElement(Text, { style: [s.tdDark, { flex: 2 }] }, st.student.name),
              React.createElement(Text, { style: [s.td, { width: 65 }] }, `${st.avgPct.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${st.examsTaken}`),
              React.createElement(Text, { style: [s.td, { width: 65 }] }, st.trend),
              React.createElement(Text, { style: [s.td, { width: 65 }] }, st.avgPct >= classPassingPct ? 'Passing' : 'Below'),
            )
          ),
        ]
      }

      function examSection() {
        return [
          React.createElement(Text, { style: s.insightTitle }, 'Per Exam Insight'),
          React.createElement(Text, { style: s.insightDesc }, 'Detailed statistics for every exam.'),
          React.createElement(View, { style: s.headerRow },
            React.createElement(Text, { style: [s.th, { flex: 2 }] }, 'Exam'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Avg'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Median'),
            React.createElement(Text, { style: [s.th, { width: 50 }] }, 'Std Dev'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Pass Rate'),
            React.createElement(Text, { style: [s.th, { width: 50 }] }, 'Students'),
          ),
          ...examStats.map((es, i) => {
            const pr = es.scores.length > 0 ? (es.passCount / es.scores.length * 100) : 0
            return React.createElement(View, { key: `exam-${i}`, style: i % 2 === 0 ? s.row : s.rowAlt },
              React.createElement(Text, { style: [s.tdDark, { flex: 2 }] }, es.exam.name),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${es.avg.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${es.median.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 50 }] }, `±${es.stdDev.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${pr.toFixed(0)}%`),
              React.createElement(Text, { style: [s.td, { width: 50 }] }, `${es.scores.length}`),
            )
          }),
        ]
      }

      function subjectSection() {
        const subjectMap = new Map<string, number[]>()
        const passMap = new Map<string, number>()
        const countMap = new Map<string, number>()
        for (const es of examStats) {
          const name = es.exam.subjects?.name
          if (!name || name.toLowerCase() === 'assessment') continue
          if (!subjectMap.has(name)) { subjectMap.set(name, []); passMap.set(name, 0); countMap.set(name, 0) }
          es.scores.forEach(sc => {
            subjectMap.get(name)!.push(sc.percentage)
            if (sc.percentage >= classPassingPct) passMap.set(name, (passMap.get(name) ?? 0) + 1)
          })
          countMap.set(name, (countMap.get(name) ?? 0) + 1)
        }
        const rows = Array.from(subjectMap.entries()).map(([name, pcts]) => ({
          name,
          avg: pcts.length > 0 ? calcMean(pcts) : 0,
          passRate: pcts.length > 0 ? ((passMap.get(name) ?? 0) / pcts.length * 100) : 0,
          exams: countMap.get(name) ?? 0,
          scores: pcts.length,
        })).sort((a, b) => b.avg - a.avg)

        return [
          React.createElement(Text, { style: s.insightTitle }, 'Per Subject Insight'),
          React.createElement(Text, { style: s.insightDesc }, 'Average score and pass rate grouped by subject (Assessment excluded).'),
          React.createElement(View, { style: s.headerRow },
            React.createElement(Text, { style: [s.th, { flex: 2 }] }, 'Subject'),
            React.createElement(Text, { style: [s.th, { width: 70 }] }, 'Avg Score'),
            React.createElement(Text, { style: [s.th, { width: 70 }] }, 'Pass Rate'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Exams'),
            React.createElement(Text, { style: [s.th, { width: 55 }] }, 'Scores'),
          ),
          ...rows.map((r, i) =>
            React.createElement(View, { key: `subject-${i}`, style: i % 2 === 0 ? s.row : s.rowAlt },
              React.createElement(Text, { style: [s.tdDark, { flex: 2 }] }, r.name),
              React.createElement(Text, { style: [s.td, { width: 70 }] }, `${r.avg.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 70 }] }, `${r.passRate.toFixed(0)}%`),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${r.exams}`),
              React.createElement(Text, { style: [s.td, { width: 55 }] }, `${r.scores}`),
            )
          ),
        ]
      }

      function schoolSection() {
        return [
          React.createElement(Text, { style: s.insightTitle }, 'Per School Insight'),
          React.createElement(Text, { style: s.insightDesc }, 'Average score and student count grouped by school.'),
          React.createElement(View, { style: s.headerRow },
            React.createElement(Text, { style: [s.th, { flex: 2 }] }, 'School'),
            React.createElement(Text, { style: [s.th, { width: 80 }] }, 'Avg Score'),
            React.createElement(Text, { style: [s.th, { width: 70 }] }, 'Pass Rate'),
            React.createElement(Text, { style: [s.th, { width: 60 }] }, 'Students'),
          ),
          ...schoolStats.map((sc, i) => {
            const sts = studentStats.filter(st => sc.students.find(s => s.id === st.student.id))
            const pr = sts.length > 0 ? (sts.filter(st => st.avgPct >= classPassingPct).length / sts.length * 100) : 0
            return React.createElement(View, { key: `school-${i}`, style: i % 2 === 0 ? s.row : s.rowAlt },
              React.createElement(Text, { style: [s.tdDark, { flex: 2 }] }, sc.school),
              React.createElement(Text, { style: [s.td, { width: 80 }] }, `${sc.avgPct.toFixed(1)}%`),
              React.createElement(Text, { style: [s.td, { width: 70 }] }, `${pr.toFixed(0)}%`),
              React.createElement(Text, { style: [s.td, { width: 60 }] }, `${sc.students.length}`),
            )
          }),
        ]
      }

      const sectionMap: Record<string, () => React.ReactNode[]> = {
        overall: overallSection,
        student: studentSection,
        exam: examSection,
        subject: subjectSection,
        school: schoolSection,
      }

      const orderedIds = INSIGHTS.map(i => i.id).filter(id => selected.has(id))
      const sections = orderedIds.flatMap(id => sectionMap[id]?.() ?? [])

      const doc = React.createElement(Document, {},
        React.createElement(Page, { size: 'A4', orientation: 'landscape', style: s.page },
          React.createElement(Text, { style: s.brand }, 'ACADGENIUS TUTORIAL POWERHOUSE'),
          React.createElement(Text, { style: s.docTitle }, 'Performance Report'),
          React.createElement(Text, { style: s.subtitle }, className),
          React.createElement(Text, { style: s.genDate }, `Generated ${today} · Includes: ${orderedIds.map(id => INSIGHTS.find(i => i.id === id)?.label).join(', ')}`),
          React.createElement(View, { style: s.divider }),
          ...sections,
          React.createElement(View, { style: s.footer, fixed: true },
            React.createElement(Text, { style: s.footerText }, 'Acadgenius Tutorial Powerhouse – Confidential'),
            React.createElement(Text, { style: s.footerText,
              render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` } as object),
          ),
        )
      )

      const blob = await pdf(doc as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${className.replace(/\s+/g, '-')}_custom-report_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[CustomExport]', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Custom PDF Export</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Choose which insights to include. Each insight covers its full analysis section.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(selected.size === INSIGHTS.length ? new Set() : new Set(INSIGHTS.map(i => i.id)))}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {selected.size === INSIGHTS.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export PDF ({selected.size})
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {INSIGHTS.map(insight => {
          const isOn = selected.has(insight.id)
          return (
            <label
              key={insight.id}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-colors"
              style={{
                border: `1px solid ${isOn ? 'rgba(11,181,199,0.35)' : 'var(--color-border)'}`,
                backgroundColor: isOn ? 'rgba(11,181,199,0.04)' : 'var(--color-surface)',
              }}
            >
              <input type="checkbox" checked={isOn} onChange={() => toggle(insight.id)} className="hidden" />
              {isOn
                ? <CheckSquare size={18} style={{ color: '#0BB5C7', flexShrink: 0 }} />
                : <Square size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              }
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: isOn ? '#0BB5C7' : 'var(--color-text-primary)' }}>
                  {insight.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{insight.description}</p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
