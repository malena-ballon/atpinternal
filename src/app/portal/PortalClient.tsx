'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { getPortalStudents, getPortalStudentReport } from '@/app/actions'
import type { ExamRow, ScoreRow, StudentRow, SubjectRow } from '@/types'

// ── Helpers (same logic as PerformanceInsights) ────────────────────────────────
function calcMean(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length }
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

interface StudentStats {
  student: StudentRow
  scores: (ScoreRow & { exam: ExamRow })[]
  avgPct: number
  rank: number
  examsTaken: number
  trend: 'improving' | 'steady' | 'declining'
}

function computeStudentStats(
  classStudents: StudentRow[],
  exams: ExamRow[],
  allScores: ScoreRow[],
): StudentStats[] {
  const sortedExams = [...exams].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const scoresByStudent = new Map<string, ScoreRow[]>()
  for (const s of allScores) {
    if (!scoresByStudent.has(s.student_id)) scoresByStudent.set(s.student_id, [])
    scoresByStudent.get(s.student_id)!.push(s)
  }

  const withAvg = classStudents.map(student => {
    const enriched = (scoresByStudent.get(student.id) ?? [])
      .map(s => ({ ...s, exam: sortedExams.find(e => e.id === s.exam_id)! }))
      .filter(s => s.exam)
      .sort((a, b) => (a.exam.date ?? '').localeCompare(b.exam.date ?? ''))
    const avgPct = enriched.length > 0 ? calcMean(enriched.map(s => s.percentage)) : 0
    return { student, enriched, avgPct }
  })

  const sorted = [...withAvg].sort((a, b) => b.avgPct - a.avgPct)
  const rankMap = new Map(sorted.map((s, i) => [s.student.id, i + 1]))

  return withAvg.map(({ student, enriched, avgPct }) => {
    let trend: 'improving' | 'steady' | 'declining' = 'steady'
    if (enriched.length >= 2) {
      const mid = Math.ceil(enriched.length / 2)
      const delta = calcMean(enriched.slice(mid).map(s => s.percentage)) - calcMean(enriched.slice(0, mid).map(s => s.percentage))
      if (delta > 5) trend = 'improving'
      else if (delta < -5) trend = 'declining'
    }
    return { student, scores: enriched, avgPct, rank: rankMap.get(student.id) ?? 0, examsTaken: enriched.length, trend }
  })
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Props {
  classes: { id: string; name: string }[]
  theme: string
}

type Step = 'class' | 'student' | 'code' | 'report'

// ── Step card wrapper ──────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #e5e7eb' }}>
      {children}
    </div>
  )
}

function StepBadge({ n, label, active, done, theme }: { n: number; label: string; active: boolean; done: boolean; theme: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: done ? '#16A34A' : active ? theme : '#e5e7eb', color: done || active ? '#fff' : '#9ca3af' }}>
        {done ? '✓' : n}
      </div>
      <span className="text-sm font-medium" style={{ color: active ? theme : done ? '#16A34A' : '#9ca3af' }}>{label}</span>
    </div>
  )
}

// ── Report view (no export, public read-only) ──────────────────────────────────
function ReportView({
  stats, allStats, totalExams, classPassingPct, subjects, className, theme,
}: {
  stats: StudentStats
  allStats: StudentStats[]
  totalExams: number
  classPassingPct: number
  subjects: SubjectRow[]
  className: string
  theme: string
}) {
  const upcatColor = theme
  const upcatDate = new Date('2026-08-06')
  const daysUntilUpcat = Math.ceil((upcatDate.getTime() - Date.now()) / 86400000)

  const relevantSubjects = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    for (const sc of stats.scores) {
      const ids = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
      for (const id of ids) {
        if (!seen.has(id)) { seen.add(id); result.push({ id, name: subjects.find(s => s.id === id)?.name ?? '—' }) }
      }
    }
    return result
  }, [stats, subjects])

  const subjectPercentileByExam = useMemo(() => {
    const result = new Map<string, Map<string, number>>()
    for (const sc of stats.scores) {
      const examId = sc.exam.id
      const examSubjectIds = sc.exam.subject_ids ?? (sc.exam.subject_id ? [sc.exam.subject_id] : [])
      const subjMap = new Map<string, number>()
      for (const subjectId of examSubjectIds) {
        const allEntries = allStats.map(st => {
          const stSc = st.scores.find(s => s.exam.id === examId)
          if (!stSc) return null
          if (stSc.subject_scores?.length) {
            const ss = stSc.subject_scores.find(x => x.subject_id === subjectId)
            if (!ss) return null
            return { studentId: st.student.id, pct: ss.total_items > 0 ? (ss.raw_score / ss.total_items) * 100 : 0 }
          }
          if (examSubjectIds.length === 1) return { studentId: st.student.id, pct: stSc.percentage }
          return null
        }).filter(Boolean) as { studentId: string; pct: number }[]
        if (!allEntries.length) continue
        const mine = allEntries.find(x => x.studentId === stats.student.id)
        if (!mine) continue
        const countLE = allEntries.filter(x => x.pct <= mine.pct).length
        subjMap.set(subjectId, Math.min(99, Math.round((countLE / allEntries.length) * 100)))
      }
      if (subjMap.size > 0) result.set(examId, subjMap)
    }
    return result
  }, [stats, allStats])

  const subjectStats = useMemo(() => {
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
      for (const subjMap of subjectPercentileByExam.values()) {
        const pct = subjMap.get(subj.id)
        if (pct !== undefined) percentiles.push(pct)
      }
      return {
        id: subj.id, name: subj.name,
        avgGrade: grades.length > 0 ? calcMean(grades) : null,
        highestGrade: grades.length > 0 ? Math.max(...grades) : null,
        avgPercentile: percentiles.length > 0 ? Math.round(calcMean(percentiles)) : null,
      }
    }).filter(s => s.avgGrade !== null)
  }, [stats, relevantSubjects, subjectPercentileByExam])

  const highestByExam = useMemo(() => {
    const map = new Map<string, { pct: number; name: string }>()
    for (const sc of stats.scores) {
      let best: { pct: number; name: string } | null = null
      for (const st of allStats) {
        const stSc = st.scores.find(s => s.exam.id === sc.exam.id)
        if (!stSc) continue
        if (!best || stSc.percentage > best.pct) best = { pct: stSc.percentage, name: st.student.name }
      }
      if (best) map.set(sc.exam.id, best)
    }
    return map
  }, [stats, allStats])

  const trendData = stats.scores.map(s => ({ name: s.exam.name, pct: parseFloat(s.percentage.toFixed(1)) }))

  const radarData = subjectStats.map(s => ({
    subject: s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name,
    avg: parseFloat((s.avgGrade ?? 0).toFixed(1)),
    fullMark: 100,
  }))

  const trendColor = stats.trend === 'improving' ? '#16A34A' : stats.trend === 'declining' ? '#DC2626' : '#6B7280'

  const card = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${theme} 0%, ${theme}cc 100%)` }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{className}</p>
        <h2 className="text-xl font-bold text-white">{stats.student.name}</h2>
        {stats.student.school && <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{stats.student.school}</p>}
      </div>

      {/* Row 1: UPCAT + 3 stat cards */}
      <div className="flex items-stretch gap-3">
        {daysUntilUpcat > 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-2 gap-0.5">
            <span className="text-3xl font-black leading-none" style={{ color: upcatColor }}>{daysUntilUpcat}</span>
            <span className="text-xs font-bold tracking-wide uppercase" style={{ color: upcatColor }}>days until UPCAT</span>
            <span className="text-xs text-gray-400">Aug 6, 2026</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Overall Average', value: stats.avgPct.toFixed(1) + '%' },
            { label: 'Class Rank', value: `${ordinal(stats.rank)} of ${allStats.length}` },
            { label: 'Exams Taken', value: `${stats.examsTaken} / ${totalExams}` },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-4 text-center" style={card}>
              <div className="text-xl font-bold" style={{ color: '#111827' }}>{c.value}</div>
              <div className="text-xs mt-0.5 text-gray-400">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Radar + Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={card}>
          <div className="text-xs font-semibold mb-1 text-gray-600">Performance Per Subject</div>
          <div className="text-xs mb-3 text-gray-400">Average score across all exams</div>
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="avg" stroke={theme} fill={theme} fillOpacity={0.2} strokeWidth={2}
                  dot={{ r: 3, fill: theme, strokeWidth: 0 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Avg Score']} />
              </RadarChart>
            </ResponsiveContainer>
          ) : radarData.length > 0 ? (
            <div className="space-y-2 py-2">
              {radarData.map(d => (
                <div key={d.subject} className="flex items-center gap-3">
                  <span className="text-xs w-20 truncate text-gray-500">{d.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${d.avg}%`, backgroundColor: theme }} />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right text-gray-700">{d.avg}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center py-8 text-gray-400">No subject data available.</p>
          )}
        </div>

        <div className="rounded-xl p-4" style={card}>
          <div className="text-xs font-semibold mb-1 text-gray-600">Overall Performance Trend</div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">Score history across exams</span>
            <span className="text-xs font-semibold ml-auto" style={{ color: trendColor }}>
              {stats.trend === 'improving' ? '↑ Improving' : stats.trend === 'declining' ? '↓ Declining' : '→ Steady'}
            </span>
          </div>
          {trendData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Score']} />
                <Line type="monotone" dataKey="pct" stroke={theme} strokeWidth={2} dot={{ r: 3, fill: theme }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center py-8 text-gray-400">Need at least 2 exams to show trend.</p>
          )}
        </div>
      </div>

      {/* Row 3: Subject breakdown cards */}
      {subjectStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-500">Subject Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {subjectStats.map(subj => {
              const pctColor = (subj.avgPercentile ?? 0) >= 75 ? '#16A34A' : (subj.avgPercentile ?? 0) >= 50 ? theme : (subj.avgPercentile ?? 0) >= 25 ? '#D97706' : '#DC2626'
              return (
                <div key={subj.id} className="rounded-xl p-4" style={card}>
                  <div className="text-xs font-semibold truncate mb-2 text-gray-600">{subj.name}</div>
                  {subj.avgPercentile !== null && (
                    <div className="mb-1">
                      <div className="text-lg font-bold" style={{ color: pctColor }}>{ordinal(subj.avgPercentile)}</div>
                      <div className="text-xs text-gray-400">Avg Percentile</div>
                    </div>
                  )}
                  <div className="mt-2 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Your Avg Score</span>
                      <span className="text-xs font-semibold text-gray-700">{subj.avgGrade!.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Top Student Avg</span>
                      <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>{subj.highestGrade!.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Row 4: Score per exam */}
      {stats.scores.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1 text-gray-500">Score Per Exam</h3>
          <p className="text-xs mb-3 text-gray-400">Top score refers to the highest score obtained by a student.</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Exam</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">%</th>
                    {relevantSubjects.map(s => (
                      <th key={s.id} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.name} Pct.</th>
                    ))}
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Top Score</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.scores.map((s, i) => {
                    const passes = s.percentage >= (s.exam.passing_pct_override ?? classPassingPct)
                    const examSubjMap = subjectPercentileByExam.get(s.exam.id)
                    const top = highestByExam.get(s.exam.id)
                    const isTop = top && Math.abs(top.pct - s.percentage) < 0.01
                    return (
                      <tr key={s.id} style={{ borderBottom: i < stats.scores.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td className="px-4 py-3 font-medium text-gray-800">{s.exam.name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.raw_score} / {s.total_items}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 font-mono text-xs">{s.percentage.toFixed(1)}%</td>
                        {relevantSubjects.map(subj => {
                          const pct = examSubjMap?.get(subj.id)
                          return (
                            <td key={subj.id} className="px-4 py-3 text-xs text-gray-400">
                              {pct !== undefined ? ordinal(pct) : '—'}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-xs" style={{ color: isTop ? '#16A34A' : '#9ca3af' }}>
                          {top ? `${isTop ? '🏆 ' : ''}${top.pct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={passes ? { backgroundColor: 'rgba(34,197,94,0.1)', color: '#16A34A' } : { backgroundColor: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
                            {passes ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {stats.scores.length === 0 && (
        <p className="text-center py-6 text-sm text-gray-400">No exam scores recorded yet.</p>
      )}
    </div>
  )
}

// ── Main portal client ─────────────────────────────────────────────────────────
export default function PortalClient({ classes, theme }: Props) {
  const [step, setStep] = useState<Step>('class')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedClassName, setSelectedClassName] = useState('')
  const [students, setStudents] = useState<{ id: string; name: string }[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState<{
    cls: { id: string; name: string; default_passing_pct: number }
    subjects: SubjectRow[]
    exams: ExamRow[]
    scores: ScoreRow[]
    students: StudentRow[]
    studentId: string
  } | null>(null)

  const allStats = useMemo(() => {
    if (!reportData) return []
    return computeStudentStats(
      reportData.students as StudentRow[],
      reportData.exams as ExamRow[],
      reportData.scores as ScoreRow[],
    )
  }, [reportData])

  const myStats = useMemo(() => allStats.find(s => s.student.id === reportData?.studentId), [allStats, reportData])

  async function handleClassContinue() {
    if (!selectedClassId) return
    setLoading(true)
    setError('')
    const list = await getPortalStudents(selectedClassId)
    setStudents(list)
    setSelectedStudentId(list[0]?.id ?? '')
    setLoading(false)
    setStep('student')
  }

  async function handleStudentContinue() {
    if (!selectedStudentId) return
    setStep('code')
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    const result = await getPortalStudentReport(selectedStudentId, selectedClassId, code)
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Something went wrong.')
      return
    }
    setReportData(result.data as typeof reportData)
    setStep('report')
  }

  const stepsDone = { class: step !== 'class', student: step === 'code' || step === 'report', code: step === 'report' }

  return (
    <div>
      {/* Steps 1–3: centered narrow card */}
      {step !== 'report' && (
        <div className="max-w-lg mx-auto space-y-4">
          {/* Step progress */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StepBadge n={1} label="Select class" active={step === 'class'} done={stepsDone.class} theme={theme} />
            <ChevronRight size={14} className="text-gray-300" />
            <StepBadge n={2} label="Select your name" active={step === 'student'} done={stepsDone.student} theme={theme} />
            <ChevronRight size={14} className="text-gray-300" />
            <StepBadge n={3} label="Enter your code" active={step === 'code'} done={stepsDone.code} theme={theme} />
          </div>

      {/* Step 1: Class */}
      {step === 'class' && (
        <Card>
          <h2 className="text-lg font-bold mb-1" style={{ color: theme }}>Welcome, Iskolar ng Bayan!</h2>
          <p className="text-sm text-gray-400 mb-6">View your personal performance report. Select your class to get started.</p>
          <label className="block text-xs font-semibold mb-1.5 text-gray-500 uppercase tracking-wide">Your Class</label>
          <select
            value={selectedClassId}
            onChange={e => { setSelectedClassId(e.target.value); setSelectedClassName(e.target.options[e.target.selectedIndex].text) }}
            className="w-full px-3 py-2.5 rounded-xl text-sm mb-4"
            style={{ border: '1px solid #e5e7eb', outline: 'none', backgroundColor: '#f8fafc', color: '#111827' }}
          >
            <option value="">— Choose a class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={handleClassContinue}
            disabled={!selectedClassId || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: theme }}
          >
            {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span> : 'Continue →'}
          </button>
        </Card>
      )}

      {/* Step 2: Student name */}
      {step === 'student' && (
        <Card>
          <h2 className="text-lg font-bold mb-1" style={{ color: theme }}>{selectedClassName}</h2>
          <p className="text-sm text-gray-400 mb-6">Select your name from the list below.</p>
          <label className="block text-xs font-semibold mb-1.5 text-gray-500 uppercase tracking-wide">Your Name</label>
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm mb-4"
            style={{ border: '1px solid #e5e7eb', outline: 'none', backgroundColor: '#f8fafc', color: '#111827' }}
          >
            <option value="">— Choose your name —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-3">
            <button onClick={() => setStep('class')} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 flex items-center gap-1.5" style={{ border: '1px solid #e5e7eb' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={handleStudentContinue}
              disabled={!selectedStudentId}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: theme }}
            >
              Continue →
            </button>
          </div>
        </Card>
      )}

      {/* Step 3: Code */}
      {step === 'code' && (
        <Card>
          <h2 className="text-lg font-bold mb-1" style={{ color: theme }}>Enter Your Access Code</h2>
          <p className="text-sm text-gray-400 mb-6">Enter the 6-character code sent to you by your teacher.</p>
          <form onSubmit={handleCodeSubmit}>
            <label className="block text-xs font-semibold mb-1.5 text-gray-500 uppercase tracking-wide">Access Code</label>
            <div className="relative mb-4">
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
                placeholder="e.g. A3X7K2"
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl text-lg font-mono font-bold tracking-widest pr-12"
                style={{
                  border: `1.5px solid ${error ? '#DC2626' : '#e5e7eb'}`,
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                  color: theme,
                  letterSpacing: '0.3em',
                }}
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mb-3 flex items-center gap-1">✕ {error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('student')} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 flex items-center gap-1.5" style={{ border: '1px solid #e5e7eb' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="submit"
                disabled={code.trim().length < 6 || loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: theme }}
              >
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Verifying…</span> : 'View My Report →'}
              </button>
            </div>
          </form>
        </Card>
      )}
        </div>
      )}

      {/* Step 4: Report */}
      {step === 'report' && reportData && myStats && (
        <div className="space-y-4">
          <button
            onClick={() => { setStep('code'); setCode(''); setError(''); setReportData(null) }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <ReportView
            stats={myStats}
            allStats={allStats}
            totalExams={reportData.exams.length}
            classPassingPct={reportData.cls.default_passing_pct}
            subjects={reportData.subjects as SubjectRow[]}
            className={reportData.cls.name}
            theme={theme}
          />
        </div>
      )}
    </div>
  )
}
