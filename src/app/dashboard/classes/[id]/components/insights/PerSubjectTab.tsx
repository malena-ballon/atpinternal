'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { calcMean, calcMedian, calcStdDev } from '../PerformanceInsights'
import type { ExamStats, StudentStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'

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

export default function PerSubjectTab({ className, examStats, studentStats, classPassingPct }: Props) {
  const subjects = useMemo(() => buildSubjectList(examStats), [examStats])
  const [selected, setSelected] = useState<string>(() => subjects[0] ?? '')

  // NEW STATES FOR EXPORT MODAL
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSelection, setExportSelection] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSubjects = subjects.filter(s => 
    s.toLowerCase().includes(searchQuery.toLowerCase())
  )

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


  // UPDATED EXPORT FUNCTION: Zips all selected Subject PDFs into one file
// UPDATED EXPORT FUNCTION: Single PDF directly, Multiple zipped
  async function handleMultiExport() {
    if (exportSelection.length === 0) return
    setIsExporting(true)
    
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { default: SubjectReportPDF } = await import('../pdf/SubjectReportPDF')
      
      // HELPER: Calculates the stats for a given subject to avoid duplicating math
      const getStatsForSubject = (subjectName: string) => {
        const subjExams = examStats.filter(es => es.exam.subjects?.name === subjectName)
        const subjScores = subjExams.flatMap(es => es.scores)
        const subjPcts = subjScores.map(s => s.percentage)
        
        const subjAvg = subjPcts.length > 0 ? calcMean(subjPcts) : 0
        const subjMedian = subjPcts.length > 0 ? calcMedian(subjPcts) : 0
        const subjStdDev = subjPcts.length > 0 ? calcStdDev(subjPcts) : 0
        const subjPassCount = subjScores.filter(s => s.percentage >= classPassingPct).length
        const subjPassRate = subjScores.length > 0 ? (subjPassCount / subjScores.length) * 100 : 0

        const subjStudentStats = studentStats.map(st => {
          const scores = st.scores.filter(s => subjExams.find(e => e.exam.id === s.exam_id))
          const spcts = scores.map(s => s.percentage)
          return {
            name: st.student.name,
            id: st.student.id,
            avg: spcts.length > 0 ? calcMean(spcts) : null,
            examsTaken: scores.length,
          }
        }).filter(s => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)) as {name: string, id: string, avg: number, examsTaken: number}[]

        return {
          subjectName,
          avg: subjAvg,
          median: subjMedian,
          stdDev: subjStdDev,
          passRate: subjPassRate,
          totalScores: subjScores.length,
          examBreakdown: subjExams,
          students: subjStudentStats
        }
      }

      // --- LOGIC 1: SINGLE PDF EXPORT ---
      if (exportSelection.length === 1) {
        const subjectName = exportSelection[0]
        const pdfStats = getStatsForSubject(subjectName)

        const blob = await pdf(
          <SubjectReportPDF 
            className={className} 
            stats={pdfStats} 
            classPassingPct={classPassingPct} 
          />
        ).toBlob()
        
        const safeName = subjectName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        const fileName = pdfFileName(`${className}_${safeName}`, 'Subject-Report')
        
        // Download directly
        downloadBlob(blob, fileName)
      } 
      // --- LOGIC 2: MULTIPLE PDFS (ZIP EXPORT) ---
      else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        const folderName = `${className.replace(/\s+/g, '_')}_Subject_Reports`
        const reportsFolder = zip.folder(folderName)

        for (const subjectName of exportSelection) {
          const pdfStats = getStatsForSubject(subjectName)

          const blob = await pdf(
            <SubjectReportPDF 
              className={className} 
              stats={pdfStats} 
              classPassingPct={classPassingPct} 
            />
          ).toBlob()
          
          const safeName = subjectName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
          const fileName = pdfFileName(`${className}_${safeName}`, 'Subject-Report')
          
          reportsFolder?.file(fileName, blob)
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(zipBlob, `${folderName}.zip`)
      }

    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
      setShowExportModal(false)
    }
  }


  if (subjects.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No subject data available. Assign subjects to exams (excluding Assessment).
      </p>
    )
  }

  return (
    <div className="space-y-5">
      
      {/* EXPORT MODAL UI */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]" 
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Export Subject Reports</h2>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl focus:ring-2 focus:ring-[#0BB5C7] transition-all"
                style={{ 
                  backgroundColor: 'var(--color-bg)', 
                  color: 'var(--color-text-primary)', 
                  border: '1px solid var(--color-border)', 
                  outline: 'none' 
                }}
              />
            </div>

            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => {
                  const newSelection = new Set(exportSelection)
                  filteredSubjects.forEach(s => newSelection.add(s))
                  setExportSelection(Array.from(newSelection))
                }} 
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0BB5C7]/10 text-[#0BB5C7] hover:bg-[#0BB5C7]/20 transition-colors"
              >
                Select All
              </button>
              <button 
                onClick={() => setExportSelection([])} 
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                Clear All
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2">
              {filteredSubjects.length > 0 ? (
                filteredSubjects.map(s => (
                  <label key={s} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={exportSelection.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setExportSelection(prev => [...prev, s])
                        else setExportSelection(prev => prev.filter(subj => subj !== s))
                      }}
                      className="w-4 h-4 rounded border-gray-400 accent-[#0BB5C7] cursor-pointer"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {s}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  No subjects match your search.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-auto pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button 
                onClick={() => setShowExportModal(false)} 
                className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors" 
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleMultiExport}
                disabled={exportSelection.length === 0 || isExporting}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white hover:bg-[#099aa8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? 'Exporting...' : `Export Selected (${exportSelection.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header: Subject selector + Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
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
        <div>
          <ExportButton 
            onExport={async () => {
              setExportSelection([selected])
              setShowExportModal(true)
            }} 
            label="Export Subject Reports" 
          />
        </div>
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
                      formatter={(v: any) => [`${v}%`, 'Pass Rate']}
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