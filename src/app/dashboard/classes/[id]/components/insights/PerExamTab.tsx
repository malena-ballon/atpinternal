'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ordinal } from '../PerformanceInsights'
import type { ExamStats } from '../PerformanceInsights'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import CopyableTable from '@/app/dashboard/components/CopyableTable'
import type { SubjectRow } from '@/types'
import { Mail } from 'lucide-react'
import EmailComposeStep, { type EmailRecipient } from './EmailComposeStep'
import { sendReportEmails, logActivity } from '@/app/actions'

interface Props {
  className: string
  examStats: ExamStats[]
  classPassingPct: number
  subjects?: SubjectRow[]
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

interface GeneratedPDF {
  filename: string
  blob: Blob
  studentId?: string
}

export default function PerExamTab({ className, examStats, classPassingPct, subjects }: Props) {
  const [selectedId, setSelectedId] = useState<string>(examStats[0]?.exam.id ?? '')

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportStep, setExportStep] = useState<1 | 2 | 3 | 'email'>(1)
  const [exportSelection, setExportSelection] = useState<string[]>([])
  const [reportType, setReportType] = useState<'class' | 'individual'>('class')
  const [classNameMode, setClassNameMode] = useState<'all' | 'top5'>('all')
  const [exportStudentIds, setExportStudentIds] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Email step state
  const [generatedPDFs, setGeneratedPDFs] = useState<GeneratedPDF[]>([])
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([])

  const stats = examStats.find(s => s.exam.id === selectedId)

  const filteredExams = examStats.filter(s =>
    s.exam.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Students in selected exams (for step 3 + email recipients)
  const studentsInSelectedExams = useMemo(() => {
    const seen = new Map<string, { name: string; email: string | null }>()
    for (const id of exportSelection) {
      const es = examStats.find(s => s.exam.id === id)
      if (!es) continue
      for (const sc of es.scores) {
        if (sc.student_id && sc.students?.name) {
          seen.set(sc.student_id, { name: sc.students.name, email: sc.students.email ?? null })
        }
      }
    }
    return Array.from(seen.entries())
      .map(([id, { name, email }]) => ({ id, name, email }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [exportSelection, examStats])

  const filteredStudents = studentsInSelectedExams.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function openExportModal(preselect?: string) {
    setExportSelection(preselect ? [preselect] : [])
    setExportStep(1)
    setReportType('class')
    setClassNameMode('all')
    setExportStudentIds([])
    setSearchQuery('')
    setGeneratedPDFs([])
    setEmailRecipients([])
    setShowExportModal(true)
  }

  function closeExportModal() {
    setShowExportModal(false)
    setExportStep(1)
    setExportSelection([])
    setReportType('class')
    setClassNameMode('all')
    setExportStudentIds([])
    setSearchQuery('')
    setGeneratedPDFs([])
    setEmailRecipients([])
  }

  async function generateExamPDFs(): Promise<GeneratedPDF[]> {
    const { pdf } = await import('@react-pdf/renderer')
    const { default: ExamReportPDF } = await import('../pdf/ExamReportPDF')
    const topNVisible = classNameMode === 'top5' ? 5 : undefined
    const results: GeneratedPDF[] = []

    if (reportType === 'class') {
      for (const id of exportSelection) {
        const examStat = examStats.find(s => s.exam.id === id)
        if (!examStat) continue
        const blob = await pdf(
          <ExamReportPDF className={className} stats={examStat} classPassingPct={classPassingPct} subjects={subjects} topNVisible={topNVisible} />
        ).toBlob()
        const safeName = examStat.exam.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        results.push({ filename: pdfFileName(`${className}_${safeName}`, 'Exam-Report'), blob })
      }
    } else {
      for (const studentId of exportStudentIds) {
        const studentName = studentsInSelectedExams.find(s => s.id === studentId)?.name ?? studentId
        const stuSafe = studentName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        for (const examId of exportSelection) {
          const examStat = examStats.find(s => s.exam.id === examId)
          if (!examStat) continue
          const examSafe = examStat.exam.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
          const blob = await pdf(
            <ExamReportPDF className={className} stats={examStat} classPassingPct={classPassingPct} subjects={subjects} maskedStudentId={studentId} />
          ).toBlob()
          results.push({ filename: pdfFileName(`${stuSafe}_${examSafe}`, 'Exam-Report'), blob, studentId })
        }
      }
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
      const folderName = reportType === 'class'
        ? `${className.replace(/\s+/g, '_')}_Exam_Reports`
        : `${className.replace(/\s+/g, '_')}_Individual_Exam_Reports`
      const folder = zip.folder(folderName)
      for (const p of pdfs) folder?.file(p.filename, p.blob)
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${folderName}.zip`)
    }
  }

  async function goToEmailStep() {
    setIsExporting(true)
    try {
      const pdfs = await generateExamPDFs()
      setGeneratedPDFs(pdfs)
      // Build recipients
      const recipientSource = reportType === 'individual'
        ? studentsInSelectedExams.filter(s => exportStudentIds.includes(s.id))
        : studentsInSelectedExams
      setEmailRecipients(recipientSource.map(s => ({ id: s.id, name: s.name, email: s.email, enabled: true })))
      setExportStep('email')
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownloadOnly() {
    await downloadPDFs(generatedPDFs)
    await logActivity('exported_pdf', 'class', null, className, `Downloaded Exam Report PDF(s) for: ${className} (${generatedPDFs.length} file${generatedPDFs.length !== 1 ? 's' : ''})`)
    closeExportModal()
  }

  async function handleSendAndDownload(subject: string, body: string, signature: string, extraFiles: File[]) {
    setIsSending(true)
    try {
      await downloadPDFs(generatedPDFs)

      const toBase64 = (blob: Blob): Promise<string> => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })

      const enabledRecipients = emailRecipients.filter(r => r.enabled && r.email)
      const recipientData = await Promise.all(
        enabledRecipients.map(async r => {
          const pdfs = reportType === 'individual'
            ? generatedPDFs.filter(p => p.studentId === r.id)
            : generatedPDFs
          return {
            name: r.name,
            email: r.email!,
            pdfs: await Promise.all(pdfs.map(async p => ({ filename: p.filename, base64: await toBase64(p.blob) }))),
          }
        })
      )

      const extraAttachData = await Promise.all(
        extraFiles.map(async f => {
          const base64 = await toBase64(f)
          return { filename: f.name, base64 }
        })
      )

      await sendReportEmails(recipientData, subject, body, signature, extraAttachData)
      await logActivity('sent_email', 'class', null, className, `Sent Exam Report email to ${enabledRecipients.length} recipient${enabledRecipients.length !== 1 ? 's' : ''} for: ${className}`)
      closeExportModal()
    } catch (e) {
      console.error('Send failed:', e)
    } finally {
      setIsSending(false)
    }
  }

  const effectivePassing = stats ? (stats.exam.passing_pct_override ?? classPassingPct) : classPassingPct

  const sortedByPct = useMemo(() => {
    if (!stats) return []
    return [...stats.scores].sort((a, b) => b.percentage - a.percentage)
  }, [stats])

  const percentileMap = useMemo(() => {
    if (!stats) return new Map<string, number>()
    const total = stats.scores.length
    return new Map(stats.scores.map(s => {
      const countLowerOrEqual = stats.scores.filter(x => x.percentage <= s.percentage).length
      return [s.id, Math.min(99, Math.round((countLowerOrEqual / total) * 100))]
    }))
  }, [stats])

  const passRate = stats && stats.scores.length > 0
    ? Math.round((stats.passCount / stats.scores.length) * 100)
    : 0

  const examSubjects = useMemo(() => {
    if (!stats?.exam.subject_ids?.length) return [] as { id: string; name: string }[]
    const hasSubjectScores = stats.scores.some(s => s.subject_scores?.length)
    return stats.exam.subject_ids.map(id => ({
      id,
      name: subjects?.find(s => s.id === id)?.name ?? id,
    })).filter(subj => {
      if (hasSubjectScores) return stats.scores.some(s => s.subject_scores?.some(x => x.subject_id === subj.id))
      return true
    })
  }, [stats, subjects])

  const subjectPercentileByStudent = useMemo(() => {
    if (!stats || !examSubjects.length) return new Map<string, Map<string, number>>()
    const result = new Map<string, Map<string, number>>()
    for (const subj of examSubjects) {
      const entries = stats.scores
        .map(sc => {
          if (sc.subject_scores?.length) {
            const ss = sc.subject_scores.find(x => x.subject_id === subj.id)
            if (!ss) return null
            return { id: sc.student_id, pct: ss.total_items > 0 ? (ss.raw_score / ss.total_items) * 100 : 0 }
          }
          if (examSubjects.length === 1) return { id: sc.student_id, pct: sc.percentage }
          return null
        })
        .filter(Boolean) as { id: string; pct: number }[]
      const n = entries.length
      for (const e of entries) {
        const countLE = entries.filter(x => x.pct <= e.pct).length
        if (!result.has(e.id)) result.set(e.id, new Map())
        result.get(e.id)!.set(subj.id, Math.min(99, Math.round((countLE / n) * 100)))
      }
    }
    return result
  }, [stats, examSubjects])

  // Step counts for indicator
  const isIndividual = reportType === 'individual'
  const totalSteps = isIndividual ? 4 : 3
  const stepNum = exportStep === 'email' ? totalSteps : (exportStep as number)

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
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
              {exportStep === 'email' ? (
                <>
                  <Mail size={15} style={{ color: '#0BB5C7' }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Send via Email</h2>
                </>
              ) : (
                <>
                  {[1, 2, ...(isIndividual ? [3] : [])].map((n, i, arr) => (
                    <div key={n} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: stepNum >= n ? '#0BB5C7' : 'var(--color-bg)',
                          color: stepNum >= n ? '#fff' : 'var(--color-text-muted)',
                          border: stepNum < n ? '1px solid var(--color-border)' : 'none',
                        }}>
                        {n}
                      </div>
                      {i < arr.length - 1 && <div className="h-px w-6" style={{ backgroundColor: stepNum > n ? '#0BB5C7' : 'var(--color-border)' }} />}
                    </div>
                  ))}
                  <h2 className="ml-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {exportStep === 1 ? 'Select Exam(s)' : exportStep === 2 ? 'Report Type' : 'Select Students'}
                  </h2>
                </>
              )}
            </div>

            {/* Step 1: Select exams */}
            {exportStep === 1 && (
              <>
                <input type="text" placeholder="Search exams..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl mb-3 shrink-0"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', outline: 'none' }} />
                <div className="flex gap-2 mb-3 shrink-0">
                  <button onClick={() => { const s = new Set(exportSelection); filteredExams.forEach(e => s.add(e.exam.id)); setExportSelection(Array.from(s)) }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0BB5C7]/10 text-[#0BB5C7]">Select All</button>
                  <button onClick={() => setExportSelection([])}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Clear All</button>
                </div>
                <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2">
                  {filteredExams.length > 0 ? filteredExams.map(s => (
                    <label key={s.exam.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                      <input type="checkbox" checked={exportSelection.includes(s.exam.id)}
                        onChange={e => e.target.checked ? setExportSelection(p => [...p, s.exam.id]) : setExportSelection(p => p.filter(id => id !== s.exam.id))}
                        className="w-4 h-4 accent-[#0BB5C7] cursor-pointer" />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.exam.name}</span>
                    </label>
                  )) : <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No exams match.</p>}
                </div>
                <div className="flex justify-end gap-3 pt-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={closeExportModal} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
                  <button onClick={() => { setExportStep(2); setSearchQuery('') }} disabled={exportSelection.length === 0}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white disabled:opacity-50">
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Report type */}
            {exportStep === 2 && (
              <>
                <p className="text-xs mb-4 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {exportSelection.length} exam{exportSelection.length !== 1 ? 's' : ''} selected
                </p>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {(['class', 'individual'] as const).map(type => (
                    <div key={type}>
                      <label className="flex items-start gap-3 p-4 rounded-xl cursor-pointer"
                        style={{ border: `2px solid ${reportType === type ? '#0BB5C7' : 'var(--color-border)'}`, backgroundColor: reportType === type ? 'rgba(11,181,199,0.05)' : 'var(--color-bg)' }}>
                        <input type="radio" checked={reportType === type} onChange={() => setReportType(type)} className="mt-0.5 accent-[#0BB5C7]" />
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {type === 'class' ? 'Class Report' : 'Individual Report'}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {type === 'class'
                              ? 'One PDF per exam with student scores.'
                              : 'One PDF per student — other students\' names are hidden.'}
                          </div>
                        </div>
                      </label>
                      {type === 'class' && reportType === 'class' && (
                        <div className="ml-4 mt-2 space-y-1.5">
                          {([['all', 'All student names visible'], ['top5', 'Top 5 names visible, rest hidden']] as const).map(([mode, label]) => (
                            <label key={mode} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                              style={{ backgroundColor: classNameMode === mode ? 'rgba(11,181,199,0.08)' : 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                              <input type="radio" checked={classNameMode === mode} onChange={() => setClassNameMode(mode)} className="accent-[#0BB5C7]" />
                              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-3 pt-4 mt-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={() => { setExportStep(1); setSearchQuery('') }} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>← Back</button>
                  <div className="flex gap-3">
                    <button onClick={closeExportModal} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
                    <button
                      onClick={() => {
                        if (reportType === 'class') goToEmailStep()
                        else { setExportStep(3); setSearchQuery('') }
                      }}
                      disabled={isExporting}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white disabled:opacity-50"
                    >
                      {isExporting ? 'Preparing...' : 'Next →'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Select students (individual mode) */}
            {exportStep === 3 && (
              <>
                <p className="text-xs mb-3 shrink-0" style={{ color: 'var(--color-text-muted)' }}>Select students to generate individual reports for:</p>
                <input type="text" placeholder="Search students..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl mb-3 shrink-0"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', outline: 'none' }} />
                <div className="flex gap-2 mb-3 shrink-0">
                  <button onClick={() => setExportStudentIds(studentsInSelectedExams.map(s => s.id))}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0BB5C7]/10 text-[#0BB5C7]">Select All</button>
                  <button onClick={() => setExportStudentIds([])}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Clear All</button>
                </div>
                <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2">
                  {filteredStudents.length > 0 ? filteredStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                      <input type="checkbox" checked={exportStudentIds.includes(s.id)}
                        onChange={e => e.target.checked ? setExportStudentIds(p => [...p, s.id]) : setExportStudentIds(p => p.filter(id => id !== s.id))}
                        className="w-4 h-4 accent-[#0BB5C7] cursor-pointer" />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                    </label>
                  )) : <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No students found.</p>}
                </div>
                <div className="flex justify-between gap-3 pt-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={() => { setExportStep(2); setSearchQuery('') }} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>← Back</button>
                  <div className="flex gap-3">
                    <button onClick={closeExportModal} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
                    <button
                      onClick={goToEmailStep}
                      disabled={exportStudentIds.length === 0 || isExporting}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white disabled:opacity-50"
                    >
                      {isExporting ? 'Preparing...' : `Next → (${exportStudentIds.length})`}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Email step */}
            {exportStep === 'email' && (
              <EmailComposeStep
                recipients={emailRecipients}
                onRecipientsChange={setEmailRecipients}
                pdfSummary={`${generatedPDFs.length} PDF${generatedPDFs.length !== 1 ? 's' : ''} auto-attached`}
                onSend={handleSendAndDownload}
                onDownloadOnly={handleDownloadOnly}
                onBack={() => setExportStep(reportType === 'class' ? 2 : 3)}
                isSending={isSending}
              />
            )}
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
          <ExportButton onExport={async () => openExportModal(selectedId)} label="Export Exam Reports" />
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

          {/* Score table */}
          {sortedByPct.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Student Scores &amp; Percentile Ranks</h3>
              <CopyableTable
                headers={['#', 'Student', 'Score', '%', 'Overall Pct.', ...examSubjects.map(s => `${s.name} Pct.`), 'Result']}
                rows={sortedByPct.map((s, i) => {
                  const passes = s.percentage >= effectivePassing
                  const overallPct = percentileMap.get(s.id) ?? 0
                  const stuSubjMap = subjectPercentileByStudent.get(s.student_id)
                  return [
                    { display: <span style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>, copy: String(i + 1) },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.students?.name ?? '—'}</span>, copy: s.students?.name ?? '—' },
                    { display: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.raw_score} / {s.total_items}</span>, copy: `${s.raw_score} / ${s.total_items}` },
                    { display: <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{s.percentage.toFixed(1)}%</span>, copy: s.percentage.toFixed(1) + '%' },
                    { display: <span style={{ color: 'var(--color-text-muted)' }}>{ordinal(overallPct)}</span>, copy: ordinal(overallPct) },
                    ...examSubjects.map(subj => {
                      const pct = stuSubjMap?.get(subj.id)
                      return {
                        display: pct !== undefined ? <span style={{ color: 'var(--color-text-muted)' }}>{ordinal(pct)}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
                        copy: pct !== undefined ? ordinal(pct) : '—',
                      }
                    }),
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
