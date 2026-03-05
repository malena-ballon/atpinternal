'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, X, ArrowUpDown, Pencil } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, SessionStatus, ClassRow, TeacherRow } from '@/types'
import ScheduleTable from './components/ScheduleTable'
import SessionFormModal from './components/SessionFormModal'
import BulkAddSessionModal from './components/BulkAddSessionModal'

function ScheduleContent() {
  const router = useRouter()
  const params = useSearchParams()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<SessionRow | null>(null)
  const [dupTarget, setDupTarget] = useState<SessionRow | null>(null)

  // Filter state (synced with URL params)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [filterClass, setFilterClass] = useState(params.get('class') ?? '')
  const [filterTeacher, setFilterTeacher] = useState(params.get('teacher') ?? '')
  const [filterStatus, setFilterStatus] = useState(params.get('status') ?? '')
  const [filterFrom, setFilterFrom] = useState(params.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(params.get('to') ?? '')
  const [filterSubject, setFilterSubject] = useState(params.get('subject') ?? '')
  const [sortAsc, setSortAsc] = useState(params.get('sort') !== 'desc')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('sessions')
        .select('id, date, start_time, end_time, status, student_count, notes, zoom_link, class_id, subject_id, teacher_id, subjects(name), teachers(name), classes(name)')
        .order('date', { ascending: false })
        .order('start_time'),
      supabase.from('classes').select('id, name, status, zoom_link, description, default_passing_pct, created_at, updated_at').eq('status', 'active'),
      supabase.from('teachers').select('id, user_id, name, specialization, email, availability'),
    ]).then(([{ data: s }, { data: c }, { data: t }]) => {
      setSessions((s ?? []) as SessionRow[])
      setClasses((c ?? []) as ClassRow[])
      setTeachers((t ?? []) as TeacherRow[])
      setLoading(false)
    })
  }, [])

  // Filtered + sorted sessions
  const filtered = sessions
    .filter(s => {
      const qLow = q.toLowerCase()
      if (q && !([s.subjects?.name, s.classes?.name, s.teachers?.name, s.notes].some(v => v?.toLowerCase().includes(qLow)))) return false
      if (filterClass && s.class_id !== filterClass) return false
      if (filterTeacher && s.teacher_id !== filterTeacher) return false
      if (filterSubject && s.subject_id !== filterSubject) return false
      if (filterStatus && s.status !== filterStatus) return false
      if (filterFrom && s.date < filterFrom) return false
      if (filterTo && s.date > filterTo) return false
      return true
    })
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
      return sortAsc ? cmp : -cmp
    })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id))
    )
  }

  async function handleCancel(id: string) {
    const supabase = createClient()
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s))
  }

  async function handleBulkStatus(ids: string[], status: SessionStatus) {
    const supabase = createClient()
    await supabase.from('sessions').update({ status }).in('id', ids)
    setSessions(prev => prev.map(s => ids.includes(s.id) ? { ...s, status } : s))
    setSelected(new Set())
  }

  function onSaved(saved: SessionRow) {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
    setEditTarget(null)
    setDupTarget(null)
  }

  function onBulkSaved(saved: SessionRow[]) {
    setSessions(prev => [...saved, ...prev])
    setShowCreate(false)
  }

  const subjectOptions = Array.from(
    new Map(sessions.filter(s => s.subject_id && s.subjects?.name).map(s => [s.subject_id!, s.subjects!.name!])),
    ([id, name]) => ({ id, name })
  ).sort((a, b) => a.name.localeCompare(b.name))

  const hasFilters = q || filterClass || filterTeacher || filterSubject || filterStatus || filterFrom || filterTo
  function clearFilters() {
    setQ(''); setFilterClass(''); setFilterTeacher(''); setFilterSubject(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('')
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
          {editMode && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              <Plus size={15} /> Add Session
            </button>
          )}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              <Pencil size={14} /> Edit
            </button>
          ) : (
            <button
              onClick={() => { setEditMode(false); setSelected(new Set()) }}
              className="px-4 py-2 text-sm font-semibold rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search subject, class, teacher..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-8 pr-3 text-sm outline-none"
            style={{ ...selectStyle, paddingLeft: '32px' }}
          />
        </div>

        <select style={selectStyle} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select style={selectStyle} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select style={selectStyle} value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">All teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="scheduled">Upcoming</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Done</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>

        <input style={selectStyle} type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
        <input style={selectStyle} type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date" />

        <button
          onClick={() => setSortAsc(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          title="Toggle sort order"
        >
          <ArrowUpDown size={13} />
          {sortAsc ? 'Oldest first' : 'Newest first'}
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
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
        onEdit={setEditTarget}
        onDuplicate={setDupTarget}
        onCancel={handleCancel}
        onBulkStatusChange={handleBulkStatus}
        editMode={editMode}
      />

      {showCreate && (
        <BulkAddSessionModal classes={classes} teachers={teachers} onClose={() => setShowCreate(false)} onSaved={onBulkSaved} />
      )}
      {editTarget && (
        <SessionFormModal mode="edit" session={editTarget} classes={classes} teachers={teachers} onClose={() => setEditTarget(null)} onSaved={onSaved} />
      )}
      {dupTarget && (
        <SessionFormModal mode="duplicate" session={dupTarget} classes={classes} teachers={teachers} onClose={() => setDupTarget(null)} onSaved={onSaved} />
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
