'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { ExamRow, ScoreRow, StudentRow, ScoreBracket } from '@/types'
import { DEFAULT_BRACKETS } from '@/types'
import OverallTab from './insights/OverallTab'
import PerStudentTab from './insights/PerStudentTab'
import PerExamTab from './insights/PerExamTab'
import PerSchoolTab from './insights/PerSchoolTab'
import EmailReportsModal from './EmailReportsModal'

// ── Shared math helpers ──────────────────────────────────────────────────────
export function calcMean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}
export function calcMedian(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
export function calcStdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = calcMean(arr)
  return Math.sqrt(calcMean(arr.map(x => (x - m) ** 2)))
}
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Exported types ───────────────────────────────────────────────────────────
export interface EnrichedScore extends ScoreRow {
  exam: ExamRow
}

export interface StudentStats {
  student: StudentRow
  scores: EnrichedScore[]      // chronological
  avgPct: number
  rank: number
  percentile: number
  examsTaken: number
  trend: 'improving' | 'steady' | 'declining'
  highest: { exam: ExamRow; pct: number } | null
  lowest: { exam: ExamRow; pct: number } | null
}

export interface ExamStats {
  exam: ExamRow
  scores: ScoreRow[]
  avg: number
  median: number
  stdDev: number
  passCount: number
  failCount: number
  highest: { name: string; pct: number } | null
  lowest: { name: string; pct: number } | null
  perfectCount: number
  distribution: { bracket: string; count: number }[]
}

export interface SchoolStats {
  school: string
  students: StudentRow[]
  avgPct: number
  examTrend: { examName: string; avg: number }[]
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  className: string
  classId?: string
  exams: ExamRow[]
  classStudents: StudentRow[]
  classPassingPct: number
  atRiskThreshold?: number | null
  scoreBrackets?: ScoreBracket[] | null
}

const TABS = [
  { id: 'overall' as const, label: 'Overall Class' },
  { id: 'student' as const, label: 'Per Student' },
  { id: 'exam' as const, label: 'Per Exam' },
  { id: 'school' as const, label: 'Per School' },
]


export default function PerformanceInsights({ className, classId, exams, classStudents, classPassingPct, atRiskThreshold, scoreBrackets }: Props) {
  const effectiveBrackets = scoreBrackets ?? DEFAULT_BRACKETS
  const effectiveAtRisk = atRiskThreshold ?? classPassingPct
  const [allScores, setAllScores] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overall' | 'student' | 'exam' | 'school'>('overall')
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    if (exams.length === 0) { setLoading(false); return }
    createClient().from('scores')
      .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at, students(name, email)')
      .in('exam_id', exams.map(e => e.id))
      .then(({ data }) => { setAllScores((data ?? []) as unknown as ScoreRow[]); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams])

  const sortedExams = useMemo(() =>
    [...exams].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')), [exams])

  const studentMap = useMemo(() =>
    new Map(classStudents.map(s => [s.id, s])), [classStudents])

  const scoresByExam = useMemo(() => {
    const map = new Map<string, ScoreRow[]>()
    for (const s of allScores) {
      if (!map.has(s.exam_id)) map.set(s.exam_id, [])
      map.get(s.exam_id)!.push(s)
    }
    return map
  }, [allScores])

  const scoresByStudent = useMemo(() => {
    const map = new Map<string, ScoreRow[]>()
    for (const s of allScores) {
      if (!map.has(s.student_id)) map.set(s.student_id, [])
      map.get(s.student_id)!.push(s)
    }
    return map
  }, [allScores])

  // ── Compute student stats ──────────────────────────────────────────────────
  const studentStats: StudentStats[] = useMemo(() => {
    const withAvg = classStudents.map(student => {
      const enriched: EnrichedScore[] = (scoresByStudent.get(student.id) ?? [])
        .map(s => ({ ...s, exam: sortedExams.find(e => e.id === s.exam_id)! }))
        .filter(s => s.exam)
        .sort((a, b) => (a.exam.date ?? '').localeCompare(b.exam.date ?? ''))
      const avgPct = enriched.length > 0 ? calcMean(enriched.map(s => s.percentage)) : 0
      return { student, enriched, avgPct }
    })

    const sorted = [...withAvg].sort((a, b) => b.avgPct - a.avgPct)
    const rankMap = new Map(sorted.map((s, i) => [s.student.id, i + 1]))

    return withAvg.map(({ student, enriched, avgPct }) => {
      const studentsWithLowerOrEqual = withAvg.filter(x => x.avgPct <= avgPct).length
      const percentile = withAvg.length > 0
        ? Math.round((studentsWithLowerOrEqual / withAvg.length) * 100) : 0

      let trend: 'improving' | 'steady' | 'declining' = 'steady'
      if (enriched.length >= 2) {
        const mid = Math.ceil(enriched.length / 2)
        const firstHalf = calcMean(enriched.slice(0, mid).map(s => s.percentage))
        const secondHalf = calcMean(enriched.slice(mid).map(s => s.percentage))
        const delta = secondHalf - firstHalf
        if (delta > 5) trend = 'improving'
        else if (delta < -5) trend = 'declining'
      }

      const pcts = enriched.map(s => ({ exam: s.exam, pct: s.percentage }))
      const highest = pcts.length > 0 ? pcts.reduce((m, x) => x.pct > m.pct ? x : m) : null
      const lowest = pcts.length > 0 ? pcts.reduce((m, x) => x.pct < m.pct ? x : m) : null

      return { student, scores: enriched, avgPct, rank: rankMap.get(student.id) ?? 0, percentile, examsTaken: enriched.length, trend, highest, lowest }
    }).sort((a, b) => a.rank - b.rank)
  }, [classStudents, scoresByStudent, sortedExams])

  // ── Compute exam stats ─────────────────────────────────────────────────────
  const examStats: ExamStats[] = useMemo(() =>
    sortedExams.map(exam => {
      const scores = scoresByExam.get(exam.id) ?? []
      const pcts = scores.map(s => s.percentage)
      const effectivePassing = exam.passing_pct_override ?? classPassingPct
      const passCount = scores.filter(s => s.percentage >= effectivePassing).length
      const byPct = [...scores].sort((a, b) => b.percentage - a.percentage)
      const getName = (s: ScoreRow) => studentMap.get(s.student_id)?.name ?? s.students?.name ?? '—'

      return {
        exam,
        scores,
        avg: pcts.length > 0 ? calcMean(pcts) : 0,
        median: calcMedian(pcts),
        stdDev: calcStdDev(pcts),
        passCount,
        failCount: scores.length - passCount,
        highest: byPct[0] ? { name: getName(byPct[0]), pct: byPct[0].percentage } : null,
        lowest: byPct[byPct.length - 1] ? { name: getName(byPct[byPct.length - 1]), pct: byPct[byPct.length - 1].percentage } : null,
        perfectCount: scores.filter(s => s.percentage === 100).length,
        distribution: effectiveBrackets.map(b => ({
          bracket: b.bracket,
          count: scores.filter(s => s.percentage >= b.min && s.percentage <= b.max).length,
        })),
      }
    }), [sortedExams, scoresByExam, classPassingPct, studentMap])

  // ── Compute school stats ───────────────────────────────────────────────────
  const schoolStats: SchoolStats[] = useMemo(() => {
    const schoolMap = new Map<string, StudentRow[]>()
    for (const s of classStudents) {
      const key = s.school?.trim() || 'Unknown'
      if (!schoolMap.has(key)) schoolMap.set(key, [])
      schoolMap.get(key)!.push(s)
    }
    return Array.from(schoolMap.entries()).map(([school, students]) => {
      const stuIds = new Set(students.map(s => s.id))
      const stuStats = studentStats.filter(s => stuIds.has(s.student.id))
      const avgPct = stuStats.length > 0 ? calcMean(stuStats.map(s => s.avgPct)) : 0
      const examTrend = sortedExams.map(exam => {
        const scores = (scoresByExam.get(exam.id) ?? []).filter(s => stuIds.has(s.student_id))
        return { examName: exam.name, avg: scores.length > 0 ? calcMean(scores.map(s => s.percentage)) : 0 }
      })
      return { school, students, avgPct, examTrend }
    }).sort((a, b) => b.avgPct - a.avgPct)
  }, [classStudents, studentStats, sortedExams, scoresByExam])

  // ── Overall: class avg over time ───────────────────────────────────────────
  const classOverTime = useMemo(() =>
    sortedExams.map(exam => {
      const scores = scoresByExam.get(exam.id) ?? []
      return {
        name: exam.name,
        avg: scores.length > 0 ? parseFloat(calcMean(scores.map(s => s.percentage)).toFixed(1)) : 0,
      }
    }), [sortedExams, scoresByExam])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin" style={{ color: '#0BB5C7' }} />
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No exam data yet. Add exams and import scores to see performance insights.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tab bar + Email Reports button */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 text-xs font-medium py-1.5 px-3 rounded-lg transition-all"
              style={activeTab === t.id
                ? { backgroundColor: '#0BB5C7', color: '#fff' }
                : { color: 'var(--color-text-muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {classId && studentStats.length > 0 && (
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg flex-shrink-0"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            title="Email student reports"
          >
            <Mail size={13} />
            Email Reports
          </button>
        )}
      </div>

      {showEmailModal && classId && (
        <EmailReportsModal
          classId={classId}
          className={className}
          studentStats={studentStats}
          classPassingPct={classPassingPct}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {activeTab === 'overall' && (
        <OverallTab
          className={className}
          classOverTime={classOverTime}
          studentStats={studentStats}
          classPassingPct={classPassingPct}
          atRiskThreshold={effectiveAtRisk}
          totalStudents={classStudents.length}
          totalExams={exams.length}
          examStats={examStats}
        />
      )}
      {activeTab === 'student' && (
        <PerStudentTab
          className={className}
          studentStats={studentStats}
          totalExams={exams.length}
          totalStudents={classStudents.length}
          classPassingPct={classPassingPct}
        />
      )}
      {activeTab === 'exam' && (
        <PerExamTab
          className={className}
          examStats={examStats}
          classPassingPct={classPassingPct}
        />
      )}
      {activeTab === 'school' && (
        <PerSchoolTab className={className} schoolStats={schoolStats} sortedExams={sortedExams} />
      )}
    </div>
  )
}
