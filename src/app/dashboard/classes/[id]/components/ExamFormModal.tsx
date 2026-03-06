'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import ThresholdInput from '@/app/dashboard/components/ThresholdInput'
import type { ExamRow, SubjectRow } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  outline: 'none',
}

interface Props {
  classId: string
  classPassingPct: number
  subjects: SubjectRow[]
  exam?: ExamRow
  onClose: () => void
  onSaved: (exam: ExamRow) => void
}

export default function ExamFormModal({ classId, classPassingPct, subjects, exam, onClose, onSaved }: Props) {
  const isEdit = !!exam
  const [name, setName] = useState(exam?.name ?? '')
  const [date, setDate] = useState(exam?.date ?? '')

  // Initialise from subject_ids (multi) or fall back to legacy subject_id
  const initIds: string[] = exam?.subject_ids?.length
    ? exam.subject_ids
    : exam?.subject_id ? [exam.subject_id] : []
  const [subjectIds, setSubjectIds] = useState<string[]>(initIds)

  const [passingOverride, setPassingOverride] = useState(
    exam?.passing_pct_override != null ? String(exam.passing_pct_override) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleSubject(id: string) {
    setSubjectIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Exam name is required.'); return }
    setError('')
    setLoading(true)
    const supabase = createClient()

    const pctValue = passingOverride.trim() !== '' ? parseFloat(passingOverride) : null
    const payload = {
      class_id: classId,
      name: name.trim(),
      date: date || null,
      subject_id: subjectIds[0] ?? null,        // keep primary for backward compat
      subject_ids: subjectIds.length > 0 ? subjectIds : null,
      passing_pct_override: pctValue,
    }

    const select = 'id, class_id, subject_id, subject_ids, name, date, total_items, passing_pct_override, created_at, updated_at, subjects(name)'

    const { data, error: err } = isEdit
      ? await supabase.from('exams').update(payload).eq('id', exam!.id).select(select).single()
      : await supabase.from('exams').insert({ ...payload, total_items: 1 }).select(select).single()

    setLoading(false)
    if (err) { setError(err.message); return }
    const formattedData = {
      ...data,
      subjects: Array.isArray(data.subjects) ? data.subjects[0] : data.subjects,
    }
    onSaved(formattedData as unknown as ExamRow)
  }

  // Non-assessment subjects only
  const selectableSubjects = subjects.filter(s => s.name.toLowerCase() !== 'assessment')

  return (
    <Modal title={isEdit ? 'Edit Exam' : 'Add Exam Record'} onClose={onClose} width="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Exam Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. 1st Comprehensive Test in Science" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date</label>
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {/* Multi-subject selector */}
        {selectableSubjects.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Subjects Covered
              <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                (select one or more — determines score import columns)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectableSubjects.map(s => {
                const active = subjectIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={active
                      ? { backgroundColor: 'rgba(11,181,199,0.15)', color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.4)' }
                      : { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                  >
                    {active && <X size={10} />}
                    {s.name}
                  </button>
                )
              })}
            </div>
            {subjectIds.length > 0 && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {subjectIds.length} subject{subjectIds.length !== 1 ? 's' : ''} selected → {subjectIds.length} score column{subjectIds.length !== 1 ? 's' : ''} during import
              </p>
            )}
          </div>
        )}

        <ThresholdInput
          label="Passing % Override"
          value={passingOverride}
          onChange={setPassingOverride}
          hint={`Leave blank to use class default (${classPassingPct}%).`}
          placeholder={`${classPassingPct}`}
        />

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create & Import Scores →'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
