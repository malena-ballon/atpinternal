'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { calcMean, calcMedian, calcStdDev } from '../PerformanceInsights'
import type { ExamStats, StudentStats } from '../PerformanceInsights'
import type { ScoreRow, SubjectRow } from '@/types'
import ExportButton, { downloadBlob, pdfFileName } from '../pdf/ExportButton'
import { Mail } from 'lucide-react'
import EmailComposeStep, { type EmailRecipient } from './EmailComposeStep'
import { sendReportEmails, logActivity } from '@/app/actions'

function getSubjectPct(score: ScoreRow, subjectId: string | undefined): number {
  if (!subjectId) return score.percentage
  const ss = score.subject_scores?.find(x => x.subject_id === subjectId)
  return ss ? Math.round((ss.raw_score / ss.total_items) * 10000) / 100 : score.percentage
}

function filterExamsBySubject(examStats: ExamStats[], subjectName: string, subjectId: string | undefined) {
  return examStats.filter(es => {
    const ids = es.exam.subject_ids?.length
      ? es.exam.subject_ids
      : es.exam.subject_id ? [es.exam.subject_id] : []
    if (subjectId && ids.includes(subjectId)) return true
    return es.exam.subjects?.name === subjectName
  })
}

interface Props {
  className: string
  examStats: ExamStats[]
  studentStats: StudentStats[]
  classPassingPct: number
  subjects?: SubjectRow[]
}

function buildSubjectList(examStats: ExamStats[], passedSubjects?: SubjectRow[]) {
  const seen = new Map<string, string>()
  if (passedSubjects) {
    for (const s of passedSubjects) {
      if (s.name.toLowerCase() === 'assessment') continue
      seen.set(s.name, s.name)
    }
  }
  for (const es of examStats) {
    const name = es.exam.subjects?.name
    if (!name || name.toLowerCase() === 'assessment') continue
    seen.set(name, name)
  }
  return Array.from(seen.keys())
}

interface GeneratedPDF {
  filename: string
  blob: Blob
  studentId?: string
}

export default function PerSubjectTab({ className, examStats, studentStats, classPassingPct, subjects: passedSubjects }: Props) {
  const subjects = useMemo(() => buildSubjectList(examStats, passedSubjects), [examStats, passedSubjects])
  const [selected, setSelected] = useState<string>(() => subjects[0] ?? '')

  const subjectId = useMemo(
    () => passedSubjects?.find(s => s.name === selected)?.id,
    [passedSubjects, selected]
  )

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

  const filteredSubjects = subjects.filter(s =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const studentsInSelectedSubjects = useMemo(() => {
    const seen = new Map<string, { name: string; email: string | null }>()
    for (const subjectName of exportSelection) {
      const subjId = passedSubjects?.find(s => s.name === subjectName)?.id
      const subjExams = filterExamsBySubject(examStats, subjectName, subjId)
      for (const es of subjExams) {
        for (const sc of es.scores) {
          if (sc.student_id && sc.students?.name) {
            seen.set(sc.student_id, { name: sc.students.name, email: sc.students.email ?? null })
          }
        }
      }
    }
    return Array.from(seen.entries())
      .map(([id, { name, email }]) => ({ id, name, email }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [exportSelection, examStats, passedSubjects])

  const filteredStudents = studentsInSelectedSubjects.filter(s =>
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

  const subjectExamStats = useMemo(
    () => filterExamsBySubject(examStats, selected, subjectId),
    [examStats, selected, subjectId]
  )

  const allScores = useMemo(
    () => subjectExamStats.flatMap(es => es.scores),
    [subjectExamStats]
  )
  const pcts = useMemo(() => allScores.map(s => getSubjectPct(s, subjectId)), [allScores, subjectId])
  const avg = pcts.length > 0 ? calcMean(pcts) : 0
  const median = pcts.length > 0 ? calcMedian(pcts) : 0
  const stdDev = pcts.length > 0 ? calcStdDev(pcts) : 0
  const passCount = pcts.filter(p => p >= classPassingPct).length
  const passRate = pcts.length > 0 ? (passCount / pcts.length) * 100 : 0

  const trendData = useMemo(() =>
    subjectExamStats.map(es => {
      const spcts = es.scores.map(s => getSubjectPct(s, subjectId))
      const examAvg = spcts.length > 0 ? calcMean(spcts) : 0
      const examPass = spcts.filter(p => p >= classPassingPct).length
      return {
        name: es.exam.name.length > 18 ? es.exam.name.slice(0, 16) + '…' : es.exam.name,
        fullName: es.exam.name,
        avg: parseFloat(examAvg.toFixed(1)),
        passRate: spcts.length > 0 ? parseFloat((examPass / spcts.length * 100).toFixed(1)) : 0,
      }
    }),
    [subjectExamStats, subjectId, classPassingPct]
  )

  const studentSubjectStats = useMemo(() => {
    const examIds = new Set(subjectExamStats.map(es => es.exam.id))
    return studentStats.map(st => {
      const scores = st.scores.filter(s => examIds.has(s.exam_id))
      const spcts = scores.map(s => getSubjectPct(s, subjectId))
      return {
        name: st.student.name,
        id: st.student.id,
        avg: spcts.length > 0 ? calcMean(spcts) : null,
        examsTaken: scores.length,
      }
    }).filter(s => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)) as {
      name: string; id: string; avg: number; examsTaken: number
    }[]
  }, [studentStats, subjectExamStats, subjectId])

  function getStatsForSubject(subjectName: string) {
    const subjId = passedSubjects?.find(s => s.name === subjectName)?.id
    const subjExams = filterExamsBySubject(examStats, subjectName, subjId)
    const subjScores = subjExams.flatMap(es => es.scores)
    const subjPcts = subjScores.map(s => getSubjectPct(s, subjId))
    const subjAvg = subjPcts.length > 0 ? calcMean(subjPcts) : 0
    const subjMedian = subjPcts.length > 0 ? calcMedian(subjPcts) : 0
    const subjStdDev = subjPcts.length > 0 ? calcStdDev(subjPcts) : 0
    const subjPassCount = subjPcts.filter(p => p >= classPassingPct).length
    const subjPassRate = subjPcts.length > 0 ? (subjPassCount / subjPcts.length) * 100 : 0
    const subjExamIds = new Set(subjExams.map(e => e.exam.id))
    const subjStudentStats = studentStats.map(st => {
      const scores = st.scores.filter(s => subjExamIds.has(s.exam_id))
      const spcts = scores.map(s => getSubjectPct(s, subjId))
      return { name: st.student.name, id: st.student.id, avg: spcts.length > 0 ? calcMean(spcts) : null, examsTaken: scores.length }
    }).filter(s => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)) as { name: string; id: string; avg: number; examsTaken: number }[]
    return { subjectName, avg: subjAvg, median: subjMedian, stdDev: subjStdDev, passRate: subjPassRate, totalScores: subjScores.length, examBreakdown: subjExams, students: subjStudentStats }
  }

  async function generateSubjectPDFs(): Promise<GeneratedPDF[]> {
    const { pdf } = await import('@react-pdf/renderer')
    const { default: SubjectReportPDF } = await import('../pdf/SubjectReportPDF')
    const topNVisible = classNameMode === 'top5' ? 5 : undefined
    const results: GeneratedPDF[] = []

    if (reportType === 'class') {
      for (const subjectName of exportSelection) {
        const pdfStats = getStatsForSubject(subjectName)
        const safeName = subjectName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        const blob = await pdf(
          <SubjectReportPDF className={className} stats={pdfStats} classPassingPct={classPassingPct} topNVisible={topNVisible} />
        ).toBlob()
        results.push({ filename: pdfFileName(`${className}_${safeName}`, 'Subject-Report'), blob })
      }
    } else {
      for (const studentId of exportStudentIds) {
        const studentName = studentsInSelectedSubjects.find(s => s.id === studentId)?.name ?? studentId
        const stuSafe = studentName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        for (const subjectName of exportSelection) {
          const pdfStats = getStatsForSubject(subjectName)
          const subjSafe = subjectName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
          const blob = await pdf(
            <SubjectReportPDF className={className} stats={pdfStats} classPassingPct={classPassingPct} maskedStudentId={studentId} />
          ).toBlob()
          results.push({ filename: pdfFileName(`${stuSafe}_${subjSafe}`, 'Subject-Report'), blob, studentId })
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
        ? `${className.replace(/\s+/g, '_')}_Subject_Reports`
        : `${className.replace(/\s+/g, '_')}_Individual_Subject_Reports`
      const folder = zip.folder(folderName)
      for (const p of pdfs) folder?.file(p.filename, p.blob)
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${folderName}.zip`)
    }
  }

  async function goToEmailStep() {
    setIsExporting(true)
    try {
      const pdfs = await generateSubjectPDFs()
      setGeneratedPDFs(pdfs)
      const recipientSource = reportType === 'individual'
        ? studentsInSelectedSubjects.filter(s => exportStudentIds.includes(s.id))
        : studentsInSelectedSubjects
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
    await logActivity('exported_pdf', 'class', null, className, `Downloaded Subject Report PDF(s) for: ${className} (${generatedPDFs.length} file${generatedPDFs.length !== 1 ? 's' : ''})`)
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
      await logActivity('sent_email', 'class', null, className, `Sent Subject Report email to ${enabledRecipients.length} recipient${enabledRecipients.length !== 1 ? 's' : ''} for: ${className}`)
      closeExportModal()
    } catch (e) {
      console.error('Send failed:', e)
    } finally {
      setIsSending(false)
    }
  }

  const isIndividual = reportType === 'individual'
  const stepNum = exportStep === 'email' ? (isIndividual ? 4 : 3) : (exportStep as number)

  if (subjects.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No subject data available. Assign subjects to exams (excluding Assessment).
      </p>
    )
  }

  return (
    <div className="space-y-5">

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
                    {exportStep === 1 ? 'Select Subject(s)' : exportStep === 2 ? 'Report Type' : 'Select Students'}
                  </h2>
                </>
              )}
            </div>

            {/* Step 1: Select subjects */}
            {exportStep === 1 && (
              <>
                <input type="text" placeholder="Search subjects..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl mb-3 shrink-0"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', outline: 'none' }} />
                <div className="flex gap-2 mb-3 shrink-0">
                  <button onClick={() => { const s = new Set(exportSelection); filteredSubjects.forEach(sub => s.add(sub)); setExportSelection(Array.from(s)) }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0BB5C7]/10 text-[#0BB5C7]">Select All</button>
                  <button onClick={() => setExportSelection([])}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Clear All</button>
                </div>
                <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2">
                  {filteredSubjects.length > 0 ? filteredSubjects.map(s => (
                    <label key={s} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                      <input type="checkbox" checked={exportSelection.includes(s)}
                        onChange={e => e.target.checked ? setExportSelection(p => [...p, s]) : setExportSelection(p => p.filter(sub => sub !== s))}
                        className="w-4 h-4 accent-[#0BB5C7] cursor-pointer" />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s}</span>
                    </label>
                  )) : <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No subjects match.</p>}
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
                  {exportSelection.length} subject{exportSelection.length !== 1 ? 's' : ''} selected
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
                              ? 'One PDF per subject with student scores.'
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
                  <button onClick={() => setExportStudentIds(studentsInSelectedSubjects.map(s => s.id))}
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
          <ExportButton onExport={async () => openExportModal(selected)} label="Export Subject Reports" />
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

          {/* Exam breakdown table */}
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
                    const spcts = es.scores.map(s => getSubjectPct(s, subjectId))
                    const sAvg = spcts.length > 0 ? calcMean(spcts) : 0
                    const sMedian = calcMedian(spcts)
                    const sStdDev = calcStdDev(spcts)
                    const sPass = spcts.filter(p => p >= classPassingPct).length
                    const pr = spcts.length > 0 ? sPass / spcts.length * 100 : 0
                    const byPct = es.scores.map((s, si) => ({ name: s.students?.name ?? '—', pct: spcts[si] })).sort((a, b) => b.pct - a.pct)
                    return (
                      <tr key={es.exam.id} style={{ borderBottom: i < subjectExamStats.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td className="px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--color-text-primary)', maxWidth: 160 }}>{es.exam.name}</td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: sAvg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>{sAvg.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{sMedian.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>±{sStdDev.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: pr >= 60 ? '#22c55e' : '#ef4444' }}>{pr.toFixed(0)}%</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{byPct[0] ? `${byPct[0].name} (${byPct[0].pct.toFixed(0)}%)` : '—'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{byPct[byPct.length - 1] ? `${byPct[byPct.length - 1].name} (${byPct[byPct.length - 1].pct.toFixed(0)}%)` : '—'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{es.scores.length}</td>
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
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Top Performers — {selected}</p>
                <div className="space-y-2">
                  {studentSubjectStats.slice(0, 8).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs w-5 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
                      <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                      <span className="text-xs font-mono font-medium" style={{ color: s.avg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>{s.avg.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-5" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Needs Attention — {selected}</p>
                <div className="space-y-2">
                  {[...studentSubjectStats].reverse().slice(0, 8).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs w-5 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{studentSubjectStats.length - i}</span>
                      <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                      <span className="text-xs font-mono font-medium" style={{ color: s.avg >= classPassingPct ? '#0BB5C7' : '#ef4444' }}>{s.avg.toFixed(1)}%</span>
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
