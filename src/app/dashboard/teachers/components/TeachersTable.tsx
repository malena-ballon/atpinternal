'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { TeacherRow } from '@/types'
import type { TeacherWithStats } from '../page'
import TeacherFormModal from './TeacherFormModal'

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const text = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ backgroundColor: 'rgba(11,181,199,0.12)', color: '#0BB5C7' }}
    >
      {text}
    </div>
  )
}

function AvailabilityTags({ teacher }: { teacher: TeacherRow }) {
  if (!teacher.availability?.length) {
    return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
  }
  const sorted = [...teacher.availability].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((e, i) => (
        <span
          key={`${e.day}-${i}`}
          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(11,181,199,0.08)', color: '#0BB5C7' }}
          title={`${e.start} – ${e.end}`}
        >
          {DAY_ABBR[e.day] ?? e.day}
        </span>
      ))}
    </div>
  )
}

export default function TeachersTable({ initialTeachers }: { initialTeachers: TeacherWithStats[] }) {
  const [teachers, setTeachers] = useState(initialTeachers)
  const [q, setQ] = useState('')
  const [editTarget, setEditTarget] = useState<TeacherRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = teachers.filter(t => {
    if (!q) return true
    const low = q.toLowerCase()
    return t.name.toLowerCase().includes(low)
      || t.email.toLowerCase().includes(low)
      || (t.specialization?.toLowerCase().includes(low) ?? false)
  })

  function onSaved(saved: TeacherRow) {
    setTeachers(prev => {
      const idx = prev.findIndex(t => t.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...saved }
        return next
      }
      return [{ ...saved, upcomingSessions: 0, totalSessions: 0 }, ...prev]
    })
    setEditTarget(null)
    setShowCreate(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('teachers').delete().eq('id', id)
    setTeachers(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
    setDeleting(false)
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
    <>
      {/* Filters + action row */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search teachers…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-8 pr-3 text-sm outline-none"
            style={{ ...selectStyle, paddingLeft: '32px' }}
          />
        </div>
        {q && (
          <button onClick={() => setQ('')} className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <X size={13} /> Clear
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            <Plus size={15} /> Add Teacher
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {q ? 'No teachers match your search.' : 'No teachers yet. Add one to get started.'}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {['Teacher', 'Specialization', 'Email', 'Availability', 'Upcoming', 'Total', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Initials name={t.name} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.name}</span>
                    </div>
                  </td>

                  {/* Specialization */}
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.specialization ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.email}
                  </td>

                  {/* Availability */}
                  <td className="px-4 py-3">
                    <AvailabilityTags teacher={t} />
                  </td>

                  {/* Upcoming */}
                  <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {t.upcomingSessions > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                        {t.upcomingSessions}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {t.totalSessions}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {deleteConfirm === t.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Delete?</span>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deleting}
                          className="text-xs font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                        >
                          {deleting ? '…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditTarget(t)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(t.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <TeacherFormModal onClose={() => setShowCreate(false)} onSaved={onSaved} />
      )}
      {editTarget && (
        <TeacherFormModal teacher={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
      )}
    </>
  )
}
