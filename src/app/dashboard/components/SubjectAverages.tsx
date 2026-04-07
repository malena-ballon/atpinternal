'use client'

import { useState, useMemo } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react'

export interface SubjectAvgClass {
  id: string
  name: string
}

export interface SubjectAvgSubject {
  id: string
  name: string
  class_id: string
}

export interface SubjectAvgScore {
  exam_id: string
  percentage: number
}

export interface SubjectAvgExam {
  id: string
  class_id: string
  subject_id: string | null
  subject_ids?: string[] | null
}

interface Props {
  classes: SubjectAvgClass[]
  subjects: SubjectAvgSubject[]
  exams: SubjectAvgExam[]
  scores: SubjectAvgScore[]
}

export default function SubjectAverages({ classes, subjects, exams, scores }: Props) {
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(classes.map(c => c.id)))
  const [showClassFilter, setShowClassFilter] = useState(false)

  function toggleClass(id: string) {
    setSelectedClasses(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedClasses(new Set(classes.map(c => c.id))) }
  function selectNone() { setSelectedClasses(new Set()) }

  // subjectId → name (for all subjects in selected classes)
  const subjectIdToName = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of subjects) {
      if (selectedClasses.has(s.class_id)) map.set(s.id, s.name)
    }
    return map
  }, [subjects, selectedClasses])

  // examId → list of subjectIds it belongs to (only for selected classes)
  const examSubjectIds = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const exam of exams) {
      if (!selectedClasses.has(exam.class_id)) continue
      const ids = exam.subject_ids?.length ? exam.subject_ids : exam.subject_id ? [exam.subject_id] : []
      map.set(exam.id, ids)
    }
    return map
  }, [exams, selectedClasses])

  // scoresByExam (only for included exams)
  const scoresByExam = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const s of scores) {
      if (!examSubjectIds.has(s.exam_id)) continue
      if (!map.has(s.exam_id)) map.set(s.exam_id, [])
      map.get(s.exam_id)!.push(s.percentage)
    }
    return map
  }, [scores, examSubjectIds])

  // Group by SUBJECT NAME (case-insensitive trim) — merge same-named subjects across classes
  const subjectStats = useMemo(() => {
    // name (lowercase) → { displayName, allPcts }
    const grouped = new Map<string, { displayName: string; allPcts: number[]; classNames: Set<string> }>()

    for (const [examId, subIds] of examSubjectIds.entries()) {
      const exam = exams.find(e => e.id === examId)
      if (!exam) continue
      const cls = classes.find(c => c.id === exam.class_id)
      const pcts = scoresByExam.get(examId) ?? []
      if (pcts.length === 0) continue

      for (const subId of subIds) {
        const name = subjectIdToName.get(subId)
        if (!name) continue
        const key = name.trim().toLowerCase()
        if (!grouped.has(key)) {
          grouped.set(key, { displayName: name.trim(), allPcts: [], classNames: new Set() })
        }
        const entry = grouped.get(key)!
        entry.allPcts.push(...pcts)
        if (cls) entry.classNames.add(cls.name)
      }
    }

    return Array.from(grouped.values())
      .map(({ displayName, allPcts, classNames }) => ({
        name: displayName,
        avg: allPcts.length > 0 ? allPcts.reduce((s, v) => s + v, 0) / allPcts.length : null,
        scoreCount: allPcts.length,
        classCount: classNames.size,
        classNames: Array.from(classNames).sort().join(', '),
      }))
      .filter(s => s.avg !== null)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
  }, [examSubjectIds, exams, classes, scoresByExam, subjectIdToName])

  const noneSelected = selectedClasses.size === 0

  if (classes.length === 0 || subjects.length === 0) return null

  return (
    <div
      className="rounded-2xl"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Average per Subject
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {selectedClasses.size === classes.length
              ? 'All classes'
              : selectedClasses.size === 0
                ? 'No classes selected'
                : `${selectedClasses.size} of ${classes.length} classes`}
            {subjectStats.length > 0 && ` · ${subjectStats.length} subject${subjectStats.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Class filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowClassFilter(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              backgroundColor: showClassFilter ? 'rgba(11,181,199,0.08)' : 'transparent',
            }}
          >
            Filter classes
            {showClassFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showClassFilter && (
            <div
              className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
              style={{
                minWidth: '200px',
                maxWidth: '280px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Classes</span>
                <div className="flex gap-2">
                  <button
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.3)' }}
                    onClick={selectAll}
                  >All</button>
                  <button
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                    onClick={selectNone}
                  >None</button>
                </div>
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {classes.map(cls => (
                  <label
                    key={cls.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    {selectedClasses.has(cls.id)
                      ? <CheckSquare size={14} style={{ color: '#0BB5C7', flexShrink: 0 }} />
                      : <Square size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    }
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedClasses.has(cls.id)}
                      onChange={() => toggleClass(cls.id)}
                    />
                    <span className="truncate">{cls.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {noneSelected ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
            Select at least one class to see averages.
          </p>
        ) : subjectStats.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
            No score data found for the selected classes.
          </p>
        ) : (
          <div className="space-y-3.5">
            {subjectStats.map(({ name, avg, scoreCount, classCount, classNames }) => {
              const pct = avg ?? 0
              const barColor = pct >= 85 ? '#22c55e' : pct >= 70 ? '#0BB5C7' : pct >= 60 ? '#f59e0b' : '#ef4444'
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="min-w-0 flex-1 mr-3">
                      <span className="text-sm font-medium truncate block" style={{ color: 'var(--color-text-primary)' }}>
                        {name}
                      </span>
                      <span className="text-xs truncate block" style={{ color: 'var(--color-text-muted)' }}>
                        {classCount === 1 ? classNames : `${classCount} classes`} · {scoreCount} score{scoreCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: barColor }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
