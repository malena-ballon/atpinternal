'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, X, ArrowUpDown, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow, SubjectRow } from '@/types'
import { getAdminUsers } from '@/app/actions'
import ScheduleTable from './components/ScheduleTable'
import BulkAddSessionModal from './components/BulkAddSessionModal'

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
]

// ── Reusable multi-select dropdown ────────────────────────────────────────────
interface MultiSelectProps {
  label: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onToggle: (val: string) => void
  onSelectAll: () => void
  onClear: () => void
}

function MultiSelect({ label, options, selected, onToggle, onSelectAll, onClear }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const allSelected = selected.size === options.length
  const displayLabel = selected.size === 0 || allSelected
    ? label
    : selected.size === 1
      ? options.find(o => selected.has(o.value))?.label ?? `1 selected`
      : `${selected.size} selected`

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: selected.size > 0 && !allSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    fontSize: '13px',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} style={selectStyle}>
        <span>{displayLabel}</span>
        <ChevronDown size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded-xl overflow-hidden"
          style={{
            minWidth: '170px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <div className="flex gap-2">
              <button
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.3)' }}
                onClick={() => onSelectAll()}
              >
                All
              </button>
              <button
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                onClick={() => onClear()}
              >
                None
              </button>
            </div>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {options.map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt.value)}
                  onChange={() => onToggle(opt.value)}
                  style={{ accentColor: '#0BB5C7' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
function ScheduleContent() {
  const params = useSearchParams()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [subjectsByClass, setSubjectsByClass] = useState<Map<string, SubjectRow[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)

  // Filter state — all multi-select
  const [q, setQ] = useState(params.get('q') ?? '')
  const [filterClasses, setFilterClasses] = useState<Set<string>>(new Set())
  const [filterTeachers, setFilterTeachers] = useState<Set<string>>(new Set())
  const [filterStatuses, setFilterStatuses] = useState<Set<SessionStatus>>(new Set(STATUS_OPTIONS.map(o => o.value)))
  const [filterSubjects, setFilterSubjects] = useState<Set<string>>(new Set())
  const [filterFrom, setFilterFrom] = useState(params.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(params.get('to') ?? '')
  const [sortAsc, setSortAsc] = useState(params.get('sort') !== 'desc')
  const [hideFinished, setHideFinished] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('sessions')
        .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, topic, class_id, subject_id, subject_ids, is_assessment, teacher_id, subjects(name), teachers(name), classes(name)')
        .order('date', { ascending: false })
        .order('start_time'),
      supabase.from('classes').select('id, name, status, zoom_link, description, default_passing_pct, created_at, updated_at').eq('status', 'active'),
      supabase.from('teachers').select('id, user_id, name, specialization, email, availability'),
      supabase.from('subjects').select('id, name, class_id, created_at'),
      getAdminUsers(),
    ]).then(([{ data: s }, { data: c }, { data: t }, { data: sub }, admins]) => {
      const loadedSessions = (s ?? []) as unknown as SessionRow[]
      const loadedClasses = (c ?? []) as ClassRow[]
      const loadedTeachers = (t ?? []) as TeacherRow[]
      const loadedSubjects = (sub ?? []) as SubjectRow[]

      // Merge admins who don't already have a teacher record
      const teacherUserIds = new Set(loadedTeachers.map(t => t.user_id).filter(Boolean))
      const adminTeachers: TeacherRow[] = (admins ?? [])
        .filter(a => !teacherUserIds.has(a.id))
        .map(a => ({ id: a.id, user_id: a.id, name: a.name, email: a.email, specialization: null, availability: null }))
      const allTeachers = [...loadedTeachers, ...adminTeachers].sort((a, b) => a.name.localeCompare(b.name))

      setSessions(loadedSessions)
      setClasses(loadedClasses)
      setTeachers(allTeachers)

      // Build subjectsByClass map
      const subMap = new Map<string, SubjectRow[]>()
      loadedSubjects.forEach(subj => {
        const arr = subMap.get(subj.class_id) ?? []
        arr.push(subj)
        subMap.set(subj.class_id, arr)
      })
      setSubjectsByClass(subMap)

      // Default: all options selected
      setFilterClasses(new Set(loadedClasses.map(c => c.id)))
      setFilterTeachers(new Set(allTeachers.map(t => t.id)))
      const subjectIds = new Set<string>()
      loadedSessions.forEach(s => {
        if (s.subject_ids?.length) s.subject_ids.forEach(id => subjectIds.add(id))
        else if (s.subject_id) subjectIds.add(s.subject_id)
      })
      setFilterSubjects(subjectIds)
      setLoading(false)
    })
  }, [])

  const filtered = sessions
    .filter(s => {
      const qLow = q.toLowerCase()
      if (q && !([s.subjects?.name, s.classes?.name, s.teachers?.name, s.notes].some(v => v?.toLowerCase().includes(qLow)))) return false
      if (filterClasses.size > 0 && !filterClasses.has(s.class_id)) return false
      if (filterTeachers.size > 0 && s.teacher_id && !filterTeachers.has(s.teacher_id)) return false
      if (filterSubjects.size > 0) {
        const ids = s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []
        if (ids.length > 0 && !ids.some(id => filterSubjects.has(id))) return false
      }
      if (filterStatuses.size > 0 && !filterStatuses.has(s.status as SessionStatus)) return false
      if (hideFinished && filterStatuses.size === 0 && (s.status === 'completed' || s.status === 'cancelled')) return false
      if (filterFrom && s.date < filterFrom) return false
      if (filterTo && s.date > filterTo) return false
      return true
    })
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
      return sortAsc ? cmp : -cmp
    })

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)))
  }

  async function handleBulkDelete(ids: string[]) {
    const supabase = createClient()
    await supabase.from('sessions').delete().in('id', ids)
    setSessions(prev => prev.filter(s => !ids.includes(s.id)))
    setSelected(new Set())
  }

  function handleSessionsChanged(updated: SessionRow[]) {
    setSessions(prev => {
      const map = new Map(updated.map(s => [s.id, s]))
      return prev.map(s => map.has(s.id) ? map.get(s.id)! : s)
    })
  }

  function handleSessionAdded(newSessions: SessionRow[]) {
    setSessions(prev => [...newSessions, ...prev])
    setShowCreate(false)
  }

  const subjectOptionMap = new Map<string, string>()
  sessions.forEach(s => {
    const classSubjects = subjectsByClass.get(s.class_id) ?? []
    const ids = s.subject_ids?.length ? s.subject_ids : s.subject_id ? [s.subject_id] : []
    ids.forEach(id => {
      if (!subjectOptionMap.has(id)) {
        const name = classSubjects.find(sub => sub.id === id)?.name ?? s.subjects?.name
        if (name) subjectOptionMap.set(id, name)
      }
    })
  })
  const subjectOptions = Array.from(subjectOptionMap, ([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label))

  const classOptions = classes.map(c => ({ value: c.id, label: c.name }))
  const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }))

  function toggle<T extends string>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setter(next)
  }

  const hasFilters = q || filterClasses.size > 0 || filterTeachers.size > 0 || filterSubjects.size > 0 || filterStatuses.size > 0 || filterFrom || filterTo
  function clearFilters() {
    setQ(''); setFilterClasses(new Set()); setFilterTeachers(new Set())
    setFilterSubjects(new Set()); setFilterStatuses(new Set()); setFilterFrom(''); setFilterTo('')
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Master Schedule</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {loading ? 'Loading…' : `${filtered.length} of ${sessions.length} sessions`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: '#0BB5C7' }}>
            <Plus size={15} /> Add Session
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Search subject, class, teacher..."
            value={q} onChange={e => setQ(e.target.value)}
            className="w-full text-sm outline-none"
            style={{ ...selectStyle, paddingLeft: '32px' }} />
        </div>

        <MultiSelect
          label="All classes"
          options={classOptions}
          selected={filterClasses}
          onToggle={val => toggle(filterClasses, val, setFilterClasses)}
          onSelectAll={() => setFilterClasses(new Set(classOptions.map(o => o.value)))}
          onClear={() => setFilterClasses(new Set())}
        />

        <MultiSelect
          label="All subjects"
          options={subjectOptions}
          selected={filterSubjects}
          onToggle={val => toggle(filterSubjects, val, setFilterSubjects)}
          onSelectAll={() => setFilterSubjects(new Set(subjectOptions.map(o => o.value)))}
          onClear={() => setFilterSubjects(new Set())}
        />

        <MultiSelect
          label="All teachers"
          options={teacherOptions}
          selected={filterTeachers}
          onToggle={val => toggle(filterTeachers, val, setFilterTeachers)}
          onSelectAll={() => setFilterTeachers(new Set(teacherOptions.map(o => o.value)))}
          onClear={() => setFilterTeachers(new Set())}
        />

        <MultiSelect
          label="All statuses"
          options={STATUS_OPTIONS}
          selected={filterStatuses as Set<string>}
          onToggle={val => toggle(filterStatuses, val as SessionStatus, setFilterStatuses)}
          onSelectAll={() => setFilterStatuses(new Set(STATUS_OPTIONS.map(o => o.value)))}
          onClear={() => setFilterStatuses(new Set())}
        />

        <input style={selectStyle} type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
        <input style={selectStyle} type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date" />

        <button onClick={() => setSortAsc(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <ArrowUpDown size={13} />
          {sortAsc ? 'Oldest first' : 'Newest first'}
        </button>

        <button onClick={() => setHideFinished(v => !v)}
          className="px-3 py-1.5 text-sm rounded-xl"
          style={{
            border: '1px solid var(--color-border)',
            color: hideFinished ? 'var(--color-text-muted)' : '#0BB5C7',
            backgroundColor: hideFinished ? 'transparent' : 'rgba(11,181,199,0.08)',
          }}>
          {hideFinished ? 'Show finished' : 'Hide finished'}
        </button>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm"
            style={{ color: 'var(--color-text-muted)' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <ScheduleTable
        sessions={filtered}
        selected={selected}
        onSelectToggle={toggleSelect}
        onSelectAll={toggleAll}
        onBulkDelete={handleBulkDelete}
        onSessionsChanged={handleSessionsChanged}
        classes={classes}
        teachers={teachers}
        subjectsByClass={subjectsByClass}
      />

      {showCreate && (
        <BulkAddSessionModal
          classes={classes}
          teachers={teachers}
          onClose={() => setShowCreate(false)}
          onSaved={handleSessionAdded}
        />
      )}
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0BB5C7', borderTopColor: 'transparent' }} />
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  )
}
