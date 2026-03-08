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
  
  // NEW STATES FOR EXPORT MODAL
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSelection, setExportSelection] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const stats = studentStats.find(s => s.student.id === selectedId)
  const filteredStudents = studentStats.filter(s => 
    s.student.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // UPDATED EXPORT FUNCTION: Zips all selected PDFs into one file
  // UPDATED EXPORT FUNCTION: Single PDF directly, Multiple zipped
  async function handleMultiExport() {
    if (exportSelection.length === 0) return
    setIsExporting(true)
    
    try {
      // Dynamically import libraries so they don't slow down the initial page load
      const { pdf } = await import('@react-pdf/renderer')
      const { default: StudentReportPDF } = await import('../pdf/StudentReportPDF')
      
      // --- LOGIC 1: SINGLE PDF EXPORT ---
      if (exportSelection.length === 1) {
        const studentStat = studentStats.find(s => s.student.id === exportSelection[0])
        if (!studentStat) throw new Error("Student not found")

        const blob = await pdf(
          <StudentReportPDF
            className={className}
            stats={studentStat}
            totalStudents={totalStudents}
            totalExams={totalExams}
            classPassingPct={classPassingPct}
          />
        ).toBlob()
        
        const safeName = studentStat.student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        const fileName = pdfFileName(`${className}_${safeName}`, 'Student-Report')
        
        // Download the single PDF directly
        downloadBlob(blob, fileName)
      } 
      // --- LOGIC 2: MULTIPLE PDFS (ZIP EXPORT) ---
      else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        const folderName = `${className.replace(/\s+/g, '_')}_Reports`
        const reportsFolder = zip.folder(folderName)

        // 1. Generate PDFs and add them to the zip folder
        for (const id of exportSelection) {
          const studentStat = studentStats.find(s => s.student.id === id)
          if (!studentStat) continue

          const blob = await pdf(
            <StudentReportPDF
              className={className}
              stats={studentStat}
              totalStudents={totalStudents}
              totalExams={totalExams}
              classPassingPct={classPassingPct}
            />
          ).toBlob()
          
          const safeName = studentStat.student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
          const fileName = pdfFileName(`${className}_${safeName}`, 'Student-Report')
          
          // Add the PDF blob into our virtual zip folder
          reportsFolder?.file(fileName, blob)
        }

        // 2. Generate the final zip file
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        
        // 3. Download the single zip file
        downloadBlob(zipBlob, `${folderName}.zip`)
      }

    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
      setShowExportModal(false)
    }
  }

  const trendData = stats?.scores.map(s => ({
    name: s.exam.name,
    pct: parseFloat(s.percentage.toFixed(1)),
  })) ?? []

  return (
    <div className="space-y-4">
      {/* EXPORT MODAL UI */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]" 
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Export Student Reports</h2>

            {/* NEW: Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search students..."
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
                // Updated to only select the *filtered* students
                onClick={() => {
                  const newSelection = new Set(exportSelection)
                  filteredStudents.forEach(s => newSelection.add(s.student.id))
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
              {filteredStudents.length > 0 ? (
                filteredStudents.map(s => (
                  <label key={s.student.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={exportSelection.includes(s.student.id)}
                      onChange={(e) => {
                        if (e.target.checked) setExportSelection(prev => [...prev, s.student.id])
                        else setExportSelection(prev => prev.filter(id => id !== s.student.id))
                      }}
                      className="w-4 h-4 rounded border-gray-400 accent-[#0BB5C7] cursor-pointer"
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {s.student.name}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  No students match your search.
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
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Select Student</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={selectStyle}>
            {studentStats.map(s => (
              <option key={s.student.id} value={s.student.id}>
                {s.student.name} — {s.avgPct.toFixed(1)}% avg
              </option>
            ))}
          </select>
        </div>
        {stats && (
          <ExportButton 
            onExport={async() => {
              // Automatically check the currently viewed student when opening the modal
              setExportSelection([selectedId])
              setShowExportModal(true)
            }} 
            label="Export Student Reports" 
          />
        )}
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
                      formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Score']}
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