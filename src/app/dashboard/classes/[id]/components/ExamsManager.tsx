'use client'

import { useState } from 'react'
import { Plus, FileText, Upload, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import type { ExamRow, ScoreRow, SubjectRow, StudentRow } from '@/types'
import ExamFormModal from './ExamFormModal'
import BulkScoreModal from './BulkScoreModal'
import ExamScoresTable from './ExamScoresTable'

interface Props {
  classId: string
  classPassingPct: number
  initialExams: ExamRow[]
  subjects: SubjectRow[]
  classStudents: StudentRow[]
}

export default function ExamsManager({ classId, classPassingPct, initialExams, subjects, classStudents }: Props) {
  const [exams, setExams] = useState<ExamRow[]>(initialExams)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ExamRow | null>(null)
  const [scoreModalExam, setScoreModalExam] = useState<ExamRow | null>(null)
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const [importedScores, setImportedScores] = useState<Record<string, ScoreRow[]>>({})

  function handleExamSaved(saved: ExamRow) {
    const isNew = !exams.find(e => e.id === saved.id)
    if (isNew) {
      setExams(prev => [saved, ...prev])
      setShowFormModal(false)
      setScoreModalExam(saved)
    } else {
      setExams(prev => prev.map(e => e.id === saved.id ? saved : e))
      setShowFormModal(false)
      setEditTarget(null)
    }
  }

  function handleScoresImported(examId: string, scores: ScoreRow[], detectedTotalItems: number) {
    setImportedScores(prev => ({ ...prev, [examId]: scores }))
    setExams(prev => prev.map(e => e.id === examId ? { ...e, total_items: detectedTotalItems } : e))
    setScoreModalExam(null)
    setExpandedExamId(examId)
  }

  function openEdit(exam: ExamRow) {
    setEditTarget(exam)
    setShowFormModal(true)
  }

  function toggleExpand(examId: string) {
    setExpandedExamId(prev => prev === examId ? null : examId)
  }

  const effectivePct = (exam: ExamRow) => exam.passing_pct_override ?? classPassingPct

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {exams.length} exam{exams.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { setEditTarget(null); setShowFormModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
          style={{ backgroundColor: '#0BB5C7' }}
        >
          <Plus size={13} /> Add Exam
        </button>
      </div>

      {/* Empty state */}
      {exams.length === 0 && (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No exams yet. Click &ldquo;Add Exam&rdquo; to create one.
        </p>
      )}

      {/* Exam list */}
      {exams.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {exams.map((exam, i) => {
            const isExpanded = expandedExamId === exam.id
            const scores = importedScores[exam.id]

            return (
              <div key={exam.id} style={{ borderBottom: i < exams.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                {/* Exam row */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(exam.id)}
                    className="flex-shrink-0 opacity-50 hover:opacity-100"
                  >
                    {isExpanded
                      ? <ChevronDown size={15} style={{ color: 'var(--color-text-primary)' }} />
                      : <ChevronRight size={15} style={{ color: 'var(--color-text-primary)' }} />
                    }
                  </button>

                  {/* Icon */}
                  <FileText size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />

                  {/* Exam info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {exam.name}
                    </span>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {exam.date && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {exam.subjects?.name && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {exam.subjects.name}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Passing: <strong style={{ color: 'var(--color-text-primary)' }}>{effectivePct(exam)}%</strong>
                        {exam.passing_pct_override != null && (
                          <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>(custom)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(exam.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium"
                      style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      {isExpanded ? 'Hide Scores' : 'View Scores'}
                    </button>
                    <button
                      onClick={() => setScoreModalExam(exam)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium"
                      style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      <Upload size={11} /> Import
                    </button>
                    <button
                      onClick={() => openEdit(exam)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg"
                      style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                      title="Edit exam"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                </div>

                {/* Scores panel */}
                {isExpanded && (
                  <div className="px-4 py-4" style={{ backgroundColor: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
                    <ExamScoresTable
                      exam={exam}
                      classPassingPct={classPassingPct}
                      externalScores={scores ?? null}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Exam form modal */}
      {showFormModal && (
        <ExamFormModal
          classId={classId}
          classPassingPct={classPassingPct}
          subjects={subjects}
          exam={editTarget ?? undefined}
          onClose={() => { setShowFormModal(false); setEditTarget(null) }}
          onSaved={handleExamSaved}
        />
      )}

      {/* Score import modal */}
      {scoreModalExam && (
        <BulkScoreModal
          exam={scoreModalExam}
          classId={classId}
          classStudents={classStudents}
          classPassingPct={classPassingPct}
          onClose={() => setScoreModalExam(null)}
          onImported={(scores, totalItems) => handleScoresImported(scoreModalExam.id, scores, totalItems)}
        />
      )}
    </div>
  )
}
