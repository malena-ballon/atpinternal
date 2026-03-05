'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Copy, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/utils/supabase/client'
import type { SessionRow, TeacherRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import SessionFormModal from '@/app/dashboard/schedule/components/SessionFormModal'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

interface Props {
  classId: string
  className: string
  classZoomLink: string | null
  initialSessions: SessionRow[]
  teachers: TeacherRow[]
}

export default function ClassSessionsTable({
  classId, className, classZoomLink, initialSessions, teachers,
}: Props) {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<SessionRow | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<SessionRow | null>(null)

  const fakeClass = {
    id: classId,
    name: className,
    zoom_link: classZoomLink,
    status: 'active' as const,
    description: null,
    default_passing_pct: 75,
    rate: null,
    created_at: '',
    updated_at: '',
    at_risk_threshold: 0,
    score_brackets: [],
  }

  async function handleCancel(id: string) {
    const supabase = createClient()
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s))
  }

  function onSaved(saved: SessionRow) {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next
      }
      return [saved, ...prev]
    })
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
          style={{ backgroundColor: '#0BB5C7' }}
        >
          <Plus size={14} />
          Add Session
        </button>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {sessions.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No sessions yet.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {['Date', 'Day', 'Time', 'Subject', 'Teacher', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {format(parseISO(s.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {format(parseISO(s.date), 'EEE')}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {fmt12(s.start_time)} – {fmt12(s.end_time)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {s.subjects?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.teachers?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status as any} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditTarget(s)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDuplicateTarget(s)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }} title="Duplicate">
                        <Copy size={13} />
                      </button>
                      {s.status !== 'cancelled' && (
                        <button onClick={() => handleCancel(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-danger)' }} title="Cancel">
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <SessionFormModal
          mode="create"
          defaultClass={fakeClass}
          classes={[fakeClass]}
          teachers={teachers}
          onClose={() => setShowCreate(false)}
          onSaved={s => { onSaved(s); setShowCreate(false) }}
        />
      )}
      {editTarget && (
        <SessionFormModal
          mode="edit"
          session={editTarget}
          defaultClass={fakeClass}
          classes={[fakeClass]}
          teachers={teachers}
          onClose={() => setEditTarget(null)}
          onSaved={s => { onSaved(s); setEditTarget(null) }}
        />
      )}
      {duplicateTarget && (
        <SessionFormModal
          mode="duplicate"
          session={duplicateTarget}
          defaultClass={fakeClass}
          classes={[fakeClass]}
          teachers={teachers}
          onClose={() => setDuplicateTarget(null)}
          onSaved={s => { onSaved(s); setDuplicateTarget(null) }}
        />
      )}
    </>
  )
}
