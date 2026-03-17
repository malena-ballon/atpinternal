'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { ordinal, calcMean } from '../PerformanceInsights'
import type { StudentStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'
import type { SubjectRow } from '@/types'
import type { PDFSubjectStat } from '../pdf/StudentReportPDF'
import { Mail } from 'lucide-react'
import EmailComposeStep, { type EmailRecipient } from './EmailComposeStep'
import { sendReportEmails, logActivity } from '@/app/actions'

interface Props {
  className: string
  studentStats: StudentStats[]
  totalExams: number
  totalStudents: number
  classPassingPct: number
  subjects?: SubjectRow[]
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

interface GeneratedPDF {
  filename: string
  blob: Blob
  studentId: string
}

export default function PerStudentTab({ className, studentStats, totalExams, totalStudents, classPassingPct, subjects }: Props) {
  const [selectedId, setSelectedId] = useState<string>(studentStats[0]?.student.id ?? '')

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportStep, setExportStep] = useState<'select' | 'email'>('select')
  const [exportSelection, setExportSelection] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [generatedPDFs, setGeneratedPDFs] = useState<GeneratedPDF[]>([])
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([])

  const stats = studentStats.find(s => s.student.id === selectedId)
  const filteredStudents = studentStats.filter(s =>
    s.student.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function computeSubjPct(studentStat: (typeof studentStats)[number]): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {}
    for (const score of studentStat.scores) {
      const examId = score.exam.id
      const examSubjectIds = score.exam.subject_ids ?? (score.exam.subject_id ? [score.exam.subject_id] : [])
      const subjMap: Record<string, number> = {}
      for (const subjectId of examSubjectIds) {
        const allEntries = studentStats
          .map(st => {
            const stScore = st.scores.find(s => s.exam.id === examId)
            if (!stScore) return null
            if (stScore.subject_scores?.length) {
              const ss = stScore.subject_scores.find(x => x.subject_id === subjectId)
              if (!ss) return null
              return { studentId: st.student.id, pct: ss.total_items > 0 ? (ss.raw_score / ss.total_items) * 100 : 0 }
            }
            if (examSubjectIds.length === 1) return { studentId: st.student.id, pct: stScore.percentage }
            return null
          })
          .filter(Boolean) as { studentId: string; pct: number }[]
        if (!allEntries.length) continue
        const mine = allEntries.find(x => x.studentId === studentStat.student.id)
        if (!mine) continue
        const countLE = allEntries.filter(x => x.pct <= mine.pct).length
        subjMap[subjectId] = Math.min(99, Math.round((countLE / allEntries.length) * 100))
      }
      if (Object.keys(subjMap).length) result[examId] = subjMap
    }
    return result
  }

  async function generateStudentPDFs(studentIds: string[]): Promise<GeneratedPDF[]> {
    const { pdf } = await import('@react-pdf/renderer')
    const { default: StudentReportPDF } = await import('../pdf/StudentReportPDF')
    const results: GeneratedPDF[] = []

    for (const id of studentIds) {
      const studentStat = studentStats.find(s => s.student.id === id)
      if (!studentStat) continue
      const subjPctData = computeSubjPct(studentStat)
      const seen = new Set<string>()
      const pdfSubjList: { id: string; name: string }[] = []
      for (const score of studentStat.scores) {
        const ids = score.exam.subject_ids ?? (score.exam.subject_id ? [score.exam.subject_id] : [])
        for (const sid of ids) {
          if (!seen.has(sid)) {
            seen.add(sid)
            pdfSubjList.push({ id: sid, name: subjects?.find(s => s.id === sid)?.name ?? '—' })
          }
        }
      }
      // Compute subject-level stats for PDF
      const pdfSubjectStats: PDFSubjectStat[] = pdfSubjList.map(subj => {
        const grades: number[] = []
        for (const sc of studentStat.scores) {
          const ids = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
          if (!ids.includes(subj.id)) continue
          if (sc.subject_scores?.length) {
            const ss = sc.subject_scores.find(x => x.subject_id === subj.id)
            if (ss && ss.total_items > 0) { grades.push((ss.raw_score / ss.total_items) * 100); continue }
          }
          if (ids.length === 1) grades.push(sc.percentage)
        }
        const percentiles: number[] = []
        for (const subjMap of Object.values(subjPctData)) {
          const pct = subjMap[subj.id]
          if (pct !== undefined) percentiles.push(pct)
        }
        // Top student avg: highest per-subject average across all students
        let highestGrade: number | null = null
        for (const st of studentStats) {
          const stGrades: number[] = []
          for (const sc of st.scores) {
            const stIds = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
            if (!stIds.includes(subj.id)) continue
            if (sc.subject_scores?.length) {
              const ss = sc.subject_scores.find(x => x.subject_id === subj.id)
              if (ss && ss.total_items > 0) { stGrades.push((ss.raw_score / ss.total_items) * 100); continue }
            }
            if (stIds.length === 1) stGrades.push(sc.percentage)
          }
          if (stGrades.length > 0) {
            const stAvg = stGrades.reduce((a, b) => a + b, 0) / stGrades.length
            if (highestGrade === null || stAvg > highestGrade) highestGrade = stAvg
          }
        }
        return {
          id: subj.id,
          name: subj.name,
          avgGrade: grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null,
          highestGrade,
          avgPercentile: percentiles.length > 0 ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null,
        }
      }).filter(s => s.avgGrade !== null)

      // Compute highest class score per exam for PDF benchmarking
      const pdfHighestByExam: Record<string, { pct: number; name: string }> = {}
      for (const sc of studentStat.scores) {
        let best: { pct: number; name: string } | null = null
        for (const st of studentStats) {
          const stSc = st.scores.find(s => s.exam.id === sc.exam.id)
          if (!stSc) continue
          if (!best || stSc.percentage > best.pct) best = { pct: stSc.percentage, name: st.student.name }
        }
        if (best) pdfHighestByExam[sc.exam.id] = best
      }

      const blob = await pdf(
        <StudentReportPDF
          className={className}
          stats={studentStat}
          totalStudents={totalStudents}
          totalExams={totalExams}
          classPassingPct={classPassingPct}
          subjectPercentileByExam={subjPctData}
          pdfSubjects={pdfSubjList}
          subjectStats={pdfSubjectStats}
          highestByExam={pdfHighestByExam}
        />
      ).toBlob()
      const safeName = studentStat.student.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
      results.push({ filename: pdfFileName(`${className}_${safeName}`, 'Student-Report'), blob, studentId: id })
    }
    return results
  }

  async function downloadPDFs(pdfs: GeneratedPDF[]) {
    if (pdfs.length === 0) return
    if (pdfs.length === 1) {
      downloadBlob(pdfs[0].blob, pdfs[0].filename)
    } else {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folderName = `${className.replace(/\s+/g, '_')}_Reports`
      const folder = zip.folder(folderName)
      for (const p of pdfs) folder?.file(p.filename, p.blob)
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${folderName}.zip`)
    }
  }

  async function goToEmailStep() {
    if (exportSelection.length === 0) return
    setIsExporting(true)
    try {
      const pdfs = await generateStudentPDFs(exportSelection)
      setGeneratedPDFs(pdfs)
      setEmailRecipients(
        exportSelection.map(id => {
          const s = studentStats.find(x => x.student.id === id)
          return { id, name: s?.student.name ?? id, email: s?.student.email ?? null, enabled: true }
        })
      )
      setExportStep('email')
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownloadOnly() {
    await downloadPDFs(generatedPDFs)
    await logActivity('exported_pdf', 'class', null, className, `Downloaded Student Report PDF(s) for: ${className} (${generatedPDFs.length} student${generatedPDFs.length !== 1 ? 's' : ''})`)
    closeModal()
  }

  async function handleSendAndDownload(subject: string, body: string, signature: string, extraFiles: File[]) {
    setIsSending(true)
    try {
      const toBase64 = (blob: Blob): Promise<string> => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })
      const enabledRecipients = emailRecipients.filter(r => r.enabled && r.email)
      const recipientData = await Promise.all(
        enabledRecipients.map(async r => {
          const p = generatedPDFs.find(x => x.studentId === r.id)
          return {
            name: r.name,
            email: r.email!,
            pdfs: p ? [{ filename: p.filename, base64: await toBase64(p.blob) }] : [],
          }
        })
      )
      const extraAttachData = await Promise.all(
        extraFiles.map(async f => ({ filename: f.name, base64: await toBase64(f) }))
      )
      await sendReportEmails(recipientData, subject, body, signature, extraAttachData)
      await logActivity('sent_email', 'class', null, className, `Sent Student Report email to ${enabledRecipients.length} recipient${enabledRecipients.length !== 1 ? 's' : ''} for: ${className}`)
      closeModal()
    } catch (e) {
      console.error('Send failed:', e)
    } finally {
      setIsSending(false)
    }
  }

  function openModal(preselect?: string) {
    setExportSelection(preselect ? [preselect] : [])
    setExportStep('select')
    setSearchQuery('')
    setGeneratedPDFs([])
    setEmailRecipients([])
    setShowExportModal(true)
  }

  function closeModal() {
    setShowExportModal(false)
    setExportStep('select')
    setExportSelection([])
    setSearchQuery('')
    setGeneratedPDFs([])
    setEmailRecipients([])
  }

  const relevantSubjects = useMemo(() => {
    if (!stats) return [] as { id: string; name: string }[]
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    for (const score of stats.scores) {
      const ids = score.exam.subject_ids ?? (score.exam.subject_id ? [score.exam.subject_id] : [])
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id)
          result.push({ id, name: subjects?.find(s => s.id === id)?.name ?? '—' })
        }
      }
    }
    return result
  }, [stats, subjects])

  const subjectPercentileByExam = useMemo(() => {
    if (!stats) return new Map<string, Map<string, number>>()
    const result = new Map<string, Map<string, number>>()
    for (const score of stats.scores) {
      const examId = score.exam.id
      const examSubjectIds = score.exam.subject_ids ?? (score.exam.subject_id ? [score.exam.subject_id] : [])
      const subjMap = new Map<string, number>()
      for (const subjectId of examSubjectIds) {
        const allEntries = studentStats
          .map(st => {
            const stScore = st.scores.find(s => s.exam.id === examId)
            if (!stScore) return null
            if (stScore.subject_scores?.length) {
              const ss = stScore.subject_scores.find(x => x.subject_id === subjectId)
              if (!ss) return null
              return { studentId: st.student.id, pct: ss.total_items > 0 ? (ss.raw_score / ss.total_items) * 100 : 0 }
            }
            if (examSubjectIds.length === 1) return { studentId: st.student.id, pct: stScore.percentage }
            return null
          })
          .filter(Boolean) as { studentId: string; pct: number }[]
        if (!allEntries.length) continue
        const mine = allEntries.find(x => x.studentId === stats.student.id)
        if (!mine) continue
        const countLE = allEntries.filter(x => x.pct <= mine.pct).length
        subjMap.set(subjectId, Math.min(99, Math.round((countLE / allEntries.length) * 100)))
      }
      if (subjMap.size > 0) result.set(examId, subjMap)
    }
    return result
  }, [stats, studentStats])

  const trendData = stats?.scores.map(s => ({
    name: s.exam.name,
    pct: parseFloat(s.percentage.toFixed(1)),
  })) ?? []

  // ── UPCAT countdown ───────────────────────────────────────────────────────
  const upcatDate = new Date('2026-08-06')
  const daysUntilUpcat = Math.ceil((upcatDate.getTime() - Date.now()) / 86400000)
  const upcatColor = '#1E3A5F'

  // ── Subject-level stats (avg grade, highest grade, avg percentile) ─────────
  const subjectStats = useMemo(() => {
    if (!stats || !relevantSubjects.length) return []
    return relevantSubjects.map(subj => {
      const grades: number[] = []
      for (const sc of stats.scores) {
        const ids = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
        if (!ids.includes(subj.id)) continue
        if (sc.subject_scores?.length) {
          const ss = sc.subject_scores.find(x => x.subject_id === subj.id)
          if (ss && ss.total_items > 0) { grades.push((ss.raw_score / ss.total_items) * 100); continue }
        }
        if (ids.length === 1) grades.push(sc.percentage)
      }
      const percentiles: number[] = []
      for (const [, subjMap] of subjectPercentileByExam) {
        const pct = subjMap.get(subj.id)
        if (pct !== undefined) percentiles.push(pct)
      }
      // Top student avg: highest per-subject average across all students
      let highestGrade: number | null = null
      for (const st of studentStats) {
        const stGrades: number[] = []
        for (const sc of st.scores) {
          const stIds = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
          if (!stIds.includes(subj.id)) continue
          if (sc.subject_scores?.length) {
            const ss = sc.subject_scores.find(x => x.subject_id === subj.id)
            if (ss && ss.total_items > 0) { stGrades.push((ss.raw_score / ss.total_items) * 100); continue }
          }
          if (stIds.length === 1) stGrades.push(sc.percentage)
        }
        if (stGrades.length > 0) {
          const stAvg = calcMean(stGrades)
          if (highestGrade === null || stAvg > highestGrade) highestGrade = stAvg
        }
      }
      return {
        id: subj.id,
        name: subj.name,
        avgGrade: grades.length > 0 ? calcMean(grades) : null,
        highestGrade,
        avgPercentile: percentiles.length > 0 ? Math.round(calcMean(percentiles)) : null,
      }
    }).filter(s => s.avgGrade !== null)
  }, [stats, relevantSubjects, subjectPercentileByExam, studentStats])

  // ── Highest class score per exam (for benchmarking) ───────────────────────
  const highestByExam = useMemo(() => {
    if (!stats) return new Map<string, { pct: number; name: string }>()
    const map = new Map<string, { pct: number; name: string }>()
    for (const sc of stats.scores) {
      let best: { pct: number; name: string } | null = null
      for (const st of studentStats) {
        const stSc = st.scores.find(s => s.exam.id === sc.exam.id)
        if (!stSc) continue
        if (!best || stSc.percentage > best.pct) best = { pct: stSc.percentage, name: st.student.name }
      }
      if (best) map.set(sc.exam.id, best)
    }
    return map
  }, [stats, studentStats])

  // ── Radar data ────────────────────────────────────────────────────────────
  const radarData = subjectStats.map(s => ({
    subject: s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name,
    avg: parseFloat((s.avgGrade ?? 0).toFixed(1)),
    fullMark: 100,
  }))

  return (
    <div className="space-y-4">
      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh]"
            style={{
              maxWidth: exportStep === 'email' ? 520 : 448,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-2 mb-4 shrink-0">
              {exportStep === 'email' ? (
                <>
                  <Mail size={15} style={{ color: '#0BB5C7' }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Send via Email</h2>
                </>
              ) : (
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Export Student Reports</h2>
              )}
            </div>

            {exportStep === 'select' && (
              <>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl mb-3 shrink-0"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', outline: 'none' }}
                />
                <div className="flex gap-2 mb-3 shrink-0">
                  <button
                    onClick={() => { const s = new Set(exportSelection); filteredStudents.forEach(st => s.add(st.student.id)); setExportSelection(Array.from(s)) }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0BB5C7]/10 text-[#0BB5C7]"
                  >Select All</button>
                  <button
                    onClick={() => setExportSelection([])}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                  >Clear All</button>
                </div>
                <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2">
                  {filteredStudents.length > 0 ? filteredStudents.map(s => (
                    <label key={s.student.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportSelection.includes(s.student.id)}
                        onChange={e => {
                          if (e.target.checked) setExportSelection(prev => [...prev, s.student.id])
                          else setExportSelection(prev => prev.filter(id => id !== s.student.id))
                        }}
                        className="w-4 h-4 accent-[#0BB5C7] cursor-pointer"
                      />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.student.name}</span>
                    </label>
                  )) : (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No students match.</p>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={closeModal} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
                  <button
                    onClick={goToEmailStep}
                    disabled={exportSelection.length === 0 || isExporting}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white disabled:opacity-50"
                  >
                    {isExporting ? 'Preparing...' : `Next → (${exportSelection.length})`}
                  </button>
                </div>
              </>
            )}

            {exportStep === 'email' && (
              <EmailComposeStep
                recipients={emailRecipients}
                onRecipientsChange={setEmailRecipients}
                pdfSummary={`${generatedPDFs.length} PDF${generatedPDFs.length !== 1 ? 's' : ''} auto-attached`}
                onSend={handleSendAndDownload}
                onDownloadOnly={handleDownloadOnly}
                onBack={() => setExportStep('select')}
                isSending={isSending}
              />
            )}
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
          <ExportButton onExport={async () => openModal(selectedId)} label="Export Student Reports" />
        )}
      </div>

      {!stats && (
        <p className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>No students found.</p>
      )}

      {stats && (
        <>
          {/* ── ROW 1: UPCAT countdown (leftmost) + 3 stat cards ── */}
          <div className="flex items-stretch gap-3">
            {daysUntilUpcat > 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-2 gap-0.5">
                <span className="text-3xl font-black leading-none" style={{ color: upcatColor }}>{daysUntilUpcat}</span>
                <span className="text-xs font-bold tracking-wide uppercase" style={{ color: upcatColor }}>days until UPCAT</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Aug 6, 2026</span>
                {stats.trend === 'improving' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full mt-1" style={{ backgroundColor: 'rgba(22,163,94,0.1)', color: '#16A34A', fontSize: 10 }}>
                    trending up ↑
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { label: 'Overall Average', value: stats.avgPct.toFixed(1) + '%' },
                { label: 'Class Rank', value: `${ordinal(stats.rank)} of ${studentStats.length}` },
                { label: 'Exams Taken', value: `${stats.examsTaken} / ${totalExams}` },
              ].map(card => (
                <div key={card.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{card.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROW 2: Spider graph + Trend line (side by side) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Spider / Radar chart */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Performance Per Subject</div>
              <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Average score across all exams</div>
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="avg" stroke="#0BB5C7" fill="#0BB5C7" fillOpacity={0.2} strokeWidth={2}
                      dot={{ r: 3, fill: '#0BB5C7', strokeWidth: 0 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Avg Score']} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : radarData.length > 0 ? (
                <div className="space-y-2 py-2">
                  {radarData.map(d => (
                    <div key={d.subject} className="flex items-center gap-3">
                      <span className="text-xs w-20 truncate" style={{ color: 'var(--color-text-secondary)' }}>{d.subject}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${d.avg}%`, backgroundColor: '#0BB5C7' }} />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right" style={{ color: 'var(--color-text-primary)' }}>{d.avg}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No subject data available.</p>
              )}
            </div>

            {/* Overall performance trend */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Overall Performance Trend</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Score history across exams</span>
                <span className="text-xs font-medium ml-auto"><TrendLabel trend={stats.trend} /></span>
              </div>
              {trendData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Score']}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#0BB5C7" strokeWidth={2} dot={{ r: 3, fill: '#0BB5C7' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  {trendData.length === 1 ? 'Need at least 2 exams to show trend.' : 'No exams yet.'}
                </p>
              )}
            </div>
          </div>

          {/* ── ROW 3: Per-subject percentile cards ── */}
          {subjectStats.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Subject Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {subjectStats.map(subj => {
                  const pctColor = (subj.avgPercentile ?? 0) >= 75 ? '#16A34A' : (subj.avgPercentile ?? 0) >= 50 ? '#0BB5C7' : (subj.avgPercentile ?? 0) >= 25 ? '#D97706' : '#DC2626'
                  return (
                    <div key={subj.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <div className="text-xs font-semibold truncate mb-2" style={{ color: 'var(--color-text-secondary)' }}>{subj.name}</div>
                      {subj.avgPercentile !== null && (
                        <div className="mb-1">
                          <div className="text-lg font-bold" style={{ color: pctColor }}>{ordinal(subj.avgPercentile)}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Percentile</div>
                        </div>
                      )}
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your Avg Score</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{subj.avgGrade!.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Top Student Avg</span>
                          <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>{subj.highestGrade!.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ROW 4: Detailed scores per exam with benchmarking ── */}
          {stats.scores.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Score Per Exam</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Top score refers to the highest score obtained by a student.</p>
              <CopyableTable
                headers={['Exam', 'Score', '%', ...relevantSubjects.map(s => `${s.name} Pct.`), 'Top Score', 'Result']}
                rows={stats.scores.map(s => {
                  const effectivePassing = s.exam.passing_pct_override ?? classPassingPct
                  const passes = s.percentage >= effectivePassing
                  const examSubjMap = subjectPercentileByExam.get(s.exam.id)
                  const top = highestByExam.get(s.exam.id)
                  const isTop = top && Math.abs(top.pct - s.percentage) < 0.01
                  return [
                    { display: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.exam.name}</span>, copy: s.exam.name },
                    { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.raw_score} / {s.total_items}</span>, copy: `${s.raw_score} / ${s.total_items}` },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{s.percentage.toFixed(1)}%</span>, copy: s.percentage.toFixed(1) + '%' },
                    ...relevantSubjects.map(subj => {
                      const pct = examSubjMap?.get(subj.id)
                      return {
                        display: pct !== undefined
                          ? <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{ordinal(pct)}</span>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
                        copy: pct !== undefined ? ordinal(pct) : '—',
                      }
                    }),
                    {
                      display: top ? (
                        <span style={{ fontSize: 12, color: isTop ? '#16A34A' : 'var(--color-text-muted)' }}>
                          {isTop ? '🏆 ' : ''}{top.pct.toFixed(1)}%
                        </span>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
                      copy: top ? `${top.pct.toFixed(1)}%` : '—',
                    },
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
