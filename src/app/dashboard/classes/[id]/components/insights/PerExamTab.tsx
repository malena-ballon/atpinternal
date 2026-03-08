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
  
  // NEW STATES FOR EXPORT MODAL
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSelection, setExportSelection] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const stats = examStats.find(s => s.exam.id === selectedId)

  // Filter exams based on search query
  const filteredExams = examStats.filter(s => 
    s.exam.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // UPDATED EXPORT FUNCTION: Zips all selected Exam PDFs into one file
// UPDATED EXPORT FUNCTION: Single PDF directly, Multiple zipped
  async function handleMultiExport() {
    if (exportSelection.length === 0) return
    setIsExporting(true)
    
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { default: ExamReportPDF } = await import('../pdf/ExamReportPDF')
      
      // --- LOGIC 1: SINGLE PDF EXPORT ---
      if (exportSelection.length === 1) {
        const examStat = examStats.find(s => s.exam.id === exportSelection[0])
        if (!examStat) throw new Error("Exam not found")

        const blob = await pdf(
          <ExamReportPDF 
            className={className} 
            stats={examStat} 
            classPassingPct={classPassingPct} 
          />
        ).toBlob()
        
        const safeName = examStat.exam.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        const fileName = pdfFileName(`${className}_${safeName}`, 'Exam-Report')
        
        // Download the single PDF directly
        downloadBlob(blob, fileName)
      } 
      // --- LOGIC 2: MULTIPLE PDFS (ZIP EXPORT) ---
      else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        const folderName = `${className.replace(/\s+/g, '_')}_Exam_Reports`
        const reportsFolder = zip.folder(folderName)

        // Generate PDFs and add them to the zip folder
        for (const id of exportSelection) {
          const examStat = examStats.find(s => s.exam.id === id)
          if (!examStat) continue

          const blob = await pdf(
            <ExamReportPDF 
              className={className} 
              stats={examStat} 
              classPassingPct={classPassingPct} 
            />
          ).toBlob()
          
          const safeName = examStat.exam.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
          const fileName = pdfFileName(`${className}_${safeName}`, 'Exam-Report')
          
          reportsFolder?.file(fileName, blob)
        }

        // Generate and download the final zip file
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
      {/* EXPORT MODAL UI */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]" 
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Export Exam Reports</h2>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search exams..."
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
                  filteredExams.forEach(s => newSelection.add(s.exam.id))
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
              {filteredExams.length > 0 ? (
                filteredExams.map(s => (
                  <label key={s.exam.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={exportSelection.includes(s.exam.id)}
                      onChange={(e) => {
                        if (e.target.checked) setExportSelection(prev => [...prev, s.exam.id])
                        else setExportSelection(prev => prev.filter(id => id !== s.exam.id))
                      }}
                      className="w-4 h-4 rounded border-gray-400 accent-[#0BB5C7] cursor-pointer"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {s.exam.name}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  No exams match your search.
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
        {stats && (
          <ExportButton 
            onExport={async () => {
              setExportSelection([selectedId])
              setShowExportModal(true)
            }} 
            label="Export Exam Reports" 
          />
        )}
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
                      formatter={(v: number | undefined) => [v ?? 0, 'Students']}
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