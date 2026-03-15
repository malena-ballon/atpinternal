'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Globe, DollarSign, FileText, X } from 'lucide-react'
import type { SubjectRow, SessionRow, TeacherRow, StudentRow, ExamRow, ClassRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import SubjectsManager from './SubjectsManager'
import SessionsSpreadsheet from './SessionsSpreadsheet'
import StudentsManager from './StudentsManager'
import ExamsManager from './ExamsManager'
import PerformanceInsights from './PerformanceInsights'
import PublicNotesEditor from './PublicNotesEditor'
import StudentCodesTab from './StudentCodesTab'

function Section({ title, children, scrollable }: { title: string; children: React.ReactNode; scrollable?: boolean }) {
  return (
    <div
      className="rounded-2xl p-6 h-full flex flex-col"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <div className="flex-1 min-h-0" style={scrollable ? { maxHeight: 480, overflowY: 'auto' } : undefined}>
        {children}
      </div>
    </div>
  )
}

type Tab = 'class' | 'insights' | 'sessions' | 'portal'

interface Props {
  cls: ClassRow
  subjects: SubjectRow[]
  sessionsData: SessionRow[]
  teachersData: TeacherRow[]
  students: StudentRow[]
  examsData: ExamRow[]
}

export default function ClassTabs({ cls, subjects, sessionsData, teachersData, students, examsData }: Props) {
  const [tab, setTab] = useState<Tab>('class')
  const [exams, setExams] = useState<ExamRow[]>(examsData)
  const [notesOpen, setNotesOpen] = useState(false)

  function handleExamSaved(saved: ExamRow) {
    setExams(prev => {
      const idx = prev.findIndex(e => e.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  function handleExamTotalItemsUpdate(examId: string, totalItems: number) {
    setExams(prev => prev.map(e => e.id === examId ? { ...e, total_items: totalItems } : e))
  }

  function handleExamsDeleted(ids: string[]) {
    setExams(prev => prev.filter(e => !ids.includes(e.id)))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'class', label: 'Class' },
    { id: 'insights', label: 'Performance Insights' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'portal', label: 'Student Portal' },
  ]

  return (
    <div>
      {/* Tab nav */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t.id ? '#0BB5C7' : 'var(--color-text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? '#0BB5C7' : 'transparent'}`,
              marginBottom: '-1px',
              outline: 'none',
              background: 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Class tab */}
      {tab === 'class' && (
        <div className="space-y-6">
          {/* Row 1: Details + Subjects — same height */}
          <div className="grid grid-cols-5 gap-6 items-stretch">
            <div className="col-span-3">
              <Section title="Class Details">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{cls.name}</h1>
                    <StatusBadge status={cls.status} />
                  </div>
                  {cls.description && (
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{cls.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    {cls.zoom_link && (
                      <div className="flex items-center gap-2">
                        <Globe size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <a href={cls.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="text-sm hover:underline" style={{ color: '#0BB5C7' }}>
                          Default Zoom Link
                        </a>
                      </div>
                    )}
                    {cls.rate != null && (
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          ₱{Number(cls.rate).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Default passing:</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {cls.default_passing_pct}%
                      </span>
                    </div>
                    {cls.at_risk_threshold != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>At-risk below:</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {cls.at_risk_threshold}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Public link:</span>
                      <Link href={`/schedule/${cls.id}`} target="_blank"
                        className="text-sm hover:underline" style={{ color: '#0BB5C7' }}>
                        /schedule/{cls.id.slice(0, 8)}…
                      </Link>
                      <button
                        onClick={() => setNotesOpen(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                        style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}
                        title="Edit public schedule notes"
                      >
                        <FileText size={11} />
                        Notes
                      </button>
                    </div>
                  </div>
                </div>
              </Section>
            </div>
            <div className="col-span-2">
              <Section title="Subjects">
                <SubjectsManager classId={cls.id} initialSubjects={subjects} />
              </Section>
            </div>
          </div>

          {/* Row 2: Students + Exams */}
          <div className="grid grid-cols-2 gap-6">
            <Section title="Students" scrollable>
              <StudentsManager classId={cls.id} className={cls.name} initialStudents={students} />
            </Section>
            <Section title="Exams" scrollable>
              <ExamsManager
                classId={cls.id}
                className={cls.name}
                classPassingPct={cls.default_passing_pct}
                exams={exams}
                subjects={subjects}
                classStudents={students}
                onExamSaved={handleExamSaved}
                onExamTotalItemsUpdate={handleExamTotalItemsUpdate}
                onExamsDeleted={handleExamsDeleted}
              />
            </Section>
          </div>
        </div>
      )}

      {/* Performance Insights tab */}
      {tab === 'insights' && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <PerformanceInsights
            className={cls.name}
            classId={cls.id}
            exams={exams}
            subjects={subjects}
            classStudents={students}
            classPassingPct={cls.default_passing_pct}
            atRiskThreshold={cls.at_risk_threshold}
            scoreBrackets={cls.score_brackets}
          />
        </div>
      )}

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SessionsSpreadsheet
            classId={cls.id}
            className={cls.name}
            initialSessions={sessionsData}
            subjects={subjects}
            teachers={teachersData}
            students={students}
            initialStudentCount={sessionsData[0]?.student_count ?? 0}
          />
        </div>
      )}

      {/* Student Portal tab */}
      {tab === 'portal' && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Student Portal</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Generate and distribute private access codes so students can view their individual report at the public portal.
            </p>
          </div>
          <StudentCodesTab classId={cls.id} className={cls.name} students={students} />
        </div>
      )}

      {/* Public Notes modal */}
      {notesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setNotesOpen(false) }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl shadow-xl flex flex-col"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', maxHeight: '80vh' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Public Schedule Notes
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Visible to anyone who opens the public schedule link
                </p>
              </div>
              <button
                onClick={() => setNotesOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto">
              <PublicNotesEditor classId={cls.id} initialNotes={cls.public_notes ?? null} initialPosition={cls.public_notes_position ?? null} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
