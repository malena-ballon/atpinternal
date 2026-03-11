'use client'

import { useState, useEffect, useRef } from 'react'
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

interface Sel { r1: number; r2: number; c1: number; c2: number }

// col 0=Date, 1=Day, 2=Time, 3=Subject, 4=Teacher, 5=Status (Actions excluded)
function getCell(s: SessionRow, c: number): string {
  if (c === 0) return format(parseISO(s.date), 'MMM d, yyyy')
  if (c === 1) return format(parseISO(s.date), 'EEE')
  if (c === 2) return `${fmt12(s.start_time)} – ${fmt12(s.end_time)}`
  if (c === 3) return s.subjects?.name ?? '—'
  if (c === 4) return s.teachers?.name ?? '—'
  if (c === 5) return s.status
  return ''
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
  const [sel, setSel] = useState<Sel | null>(null)
  const anchorRef = useRef<{ r: number; c: number } | null>(null)

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

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'c' || !sel) return
      const el = document.activeElement
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart !== el.selectionEnd) return
      e.preventDefault()
      const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)]
      const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)]
      const text = sessions.slice(r1, r2 + 1)
        .map(s => Array.from({ length: c2 - c1 + 1 }, (_, i) => getCell(s, c1 + i)).join('\t'))
        .join('\n')
      navigator.clipboard.writeText(text)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [sel, sessions])

  function cellMouseDown(r: number, c: number, e: React.MouseEvent) {
    if (e.shiftKey && anchorRef.current) {
      setSel({ r1: anchorRef.current.r, r2: r, c1: anchorRef.current.c, c2: c })
    } else {
      anchorRef.current = { r, c }
      setSel({ r1: r, r2: r, c1: c, c2: c })
    }
  }

  function inSel(r: number, c: number) {
    if (!sel) return false
    return r >= Math.min(sel.r1, sel.r2) && r <= Math.max(sel.r1, sel.r2)
      && c >= Math.min(sel.c1, sel.c2) && c <= Math.max(sel.c1, sel.c2)
  }

  function cs(r: number, c: number): React.CSSProperties {
    return inSel(r, c)
      ? { backgroundColor: 'rgba(11,181,199,0.1)', boxShadow: 'inset 0 0 0 1px rgba(11,181,199,0.45)' }
      : {}
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
      <div className="flex items-center justify-between mb-2">
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

      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Click a cell to select · Shift+click to select range · Ctrl/Cmd+C to copy
      </p>

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
                  {/* col 0: Date */}
                  <td className="px-4 py-3 text-sm" style={{ cursor: 'cell', ...cs(i, 0) }}
                    onMouseDown={e => cellMouseDown(i, 0, e)}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{format(parseISO(s.date), 'MMM d, yyyy')}</span>
                  </td>
                  {/* col 1: Day */}
                  <td className="px-4 py-3 text-sm" style={{ cursor: 'cell', ...cs(i, 1) }}
                    onMouseDown={e => cellMouseDown(i, 1, e)}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{format(parseISO(s.date), 'EEE')}</span>
                  </td>
                  {/* col 2: Time */}
                  <td className="px-4 py-3 text-sm" style={{ cursor: 'cell', ...cs(i, 2) }}
                    onMouseDown={e => cellMouseDown(i, 2, e)}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</span>
                  </td>
                  {/* col 3: Subject */}
                  <td className="px-4 py-3 text-sm" style={{ cursor: 'cell', ...cs(i, 3) }}
                    onMouseDown={e => cellMouseDown(i, 3, e)}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{s.subjects?.name ?? '—'}</span>
                  </td>
                  {/* col 4: Teacher */}
                  <td className="px-4 py-3 text-sm" style={{ cursor: 'cell', ...cs(i, 4) }}
                    onMouseDown={e => cellMouseDown(i, 4, e)}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{s.teachers?.name ?? '—'}</span>
                  </td>
                  {/* col 5: Status */}
                  <td className="px-4 py-3" style={{ cursor: 'cell', ...cs(i, 5) }}
                    onMouseDown={e => cellMouseDown(i, 5, e)}>
                    <StatusBadge status={s.status as any} size="sm" />
                  </td>
                  {/* Actions — not part of cell selection */}
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
