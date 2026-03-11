'use client'

import { useState } from 'react'
import { Plus, FileText, Upload, Pencil, ChevronDown, ChevronRight, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { ExamRow, ScoreRow, SubjectRow, StudentRow } from '@/types'
import ExamFormModal from './ExamFormModal'
import BulkScoreModal from './BulkScoreModal'
import ExamScoresTable from './ExamScoresTable'

interface Props {
  classId: string
  classPassingPct: number
  exams: ExamRow[]
  subjects: SubjectRow[]
  classStudents: StudentRow[]
  onExamSaved: (exam: ExamRow) => void
  onExamTotalItemsUpdate: (examId: string, totalItems: number) => void
  onExamsDeleted?: (ids: string[]) => void
}

export default function ExamsManager({ classId, classPassingPct, exams, subjects, classStudents, onExamSaved, onExamTotalItemsUpdate, onExamsDeleted }: Props) {
  const [showFormModal, setShowFormModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ExamRow | null>(null)
  const [scoreModalExam, setScoreModalExam] = useState<ExamRow | null>(null)
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const [importedScores, setImportedScores] = useState<Record<string, ScoreRow[]>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [fromCreateExam, setFromCreateExam] = useState<ExamRow | null>(null)

  function handleExamSaved(saved: ExamRow) {
    const isNew = !exams.find(e => e.id === saved.id)
    onExamSaved(saved)
    setShowFormModal(false)
    setEditTarget(null)
    if (isNew) {
      setFromCreateExam(saved)
      setScoreModalExam(saved)
    } else {
      setFromCreateExam(null)
    }
  }

  function handleScoresImported(examId: string, scores: ScoreRow[], detectedTotalItems: number) {
    setImportedScores(prev => ({ ...prev, [examId]: scores }))
    onExamTotalItemsUpdate(examId, detectedTotalItems)
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

  function toggleSelectId(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === exams.length ? new Set() : new Set(exams.map(e => e.id)))
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} exam${selectedIds.size !== 1 ? 's' : ''}? This will also remove all scores for these exams. This cannot be undone.`)) return
    setDeletingSelected(true)
    const supabase = createClient()
    await supabase.from('exams').delete().in('id', Array.from(selectedIds))
    onExamsDeleted?.(Array.from(selectedIds))
    setSelectedIds(new Set())
    setDeletingSelected(false)
  }

  const effectivePct = (exam: ExamRow) => exam.passing_pct_override ?? classPassingPct

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {exams.length} exam{exams.length !== 1 ? 's' : ''}
          </span>
          {exams.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              <input
                type="checkbox"
                checked={exams.length > 0 && selectedIds.size === exams.length}
                onChange={toggleSelectAll}
                style={{ accentColor: '#0BB5C7' }}
              />
              All
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-60"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}
            >
              {deletingSelected ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Delete {selectedIds.size}
            </button>
          )}
          <button
            onClick={() => { setEditTarget(null); setShowFormModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            <Plus size={13} /> Add Exam
          </button>
        </div>
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
            const isSelected = selectedIds.has(exam.id)

            return (
              <div key={exam.id} style={{ borderBottom: i < exams.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                {/* Exam row */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ backgroundColor: isSelected ? 'rgba(61,212,230,0.04)' : 'var(--color-surface)' }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectId(exam.id)}
                    style={{ accentColor: '#0BB5C7', flexShrink: 0 }}
                  />

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
                      classId={classId}
                      classStudents={classStudents}
                      subjects={subjects}
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
          subjects={subjects.filter(s => s.name.toLowerCase() !== 'assessment')}
          onClose={() => { setScoreModalExam(null); setFromCreateExam(null) }}
          onBack={fromCreateExam ? () => {
            setScoreModalExam(null)
            setFromCreateExam(null)
            setEditTarget(fromCreateExam)
            setShowFormModal(true)
          } : undefined}
          onImported={(scores, totalItems) => handleScoresImported(scoreModalExam.id, scores, totalItems)}
        />
      )}
    </div>
  )
}
