'use client'

import { useState, useMemo } from 'react'
import { Loader2, CheckCircle2, Mail, Search } from 'lucide-react'
import Modal from '@/app/dashboard/components/Modal'
import { emailSessionSchedule } from '@/app/actions'
import type { StudentRow } from '@/types'

interface Props {
  classId: string
  className: string
  students: StudentRow[]
  sessionIds: string[]
  onClose: () => void
}

export default function EmailSessionsModal({ classId, className, students, sessionIds, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(students.filter(s => s.email).map(s => s.id))
  )
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ sent: number; skipped: number; failed: number; errors: string[] } | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return students
    return students.filter(s => s.name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
  }, [students, query])

  const sendable = students.filter(s => s.email && selected.has(s.id))

  function toggleOne(id: string) {
    const s = students.find(x => x.id === id)
    if (!s?.email) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px 8px 34px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    fontSize: '14px',
    outline: 'none',
  }

  async function handleSend() {
    if (!sendable.length) return
    setSending(true)
    setProgress({ done: 0, total: sendable.length })
    let sent = 0, skipped = 0, failed = 0
    const errors: string[] = []

    const BATCH = 3
    for (let i = 0; i < sendable.length; i += BATCH) {
      const batch = sendable.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(s => emailSessionSchedule(s.id, classId, sessionIds)))
      for (const r of results) {
        if (r.skipped) skipped++
        else if (r.ok) sent++
        else { failed++; if (r.error) errors.push(r.error) }
      }
      setProgress({ done: Math.min(i + BATCH, sendable.length), total: sendable.length })
    }

    setSending(false)
    setResult({ sent, skipped, failed, errors })
  }

  if (result) {
    return (
      <Modal title="Email Schedule" onClose={onClose} width="md">
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 size={36} style={{ color: result.failed > 0 ? 'var(--color-warning)' : 'var(--color-success)', margin: '0 auto' }} />
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Done!
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {result.sent} sent · {result.skipped} skipped (no email){result.failed > 0 ? ` · ${result.failed} failed` : ''}
          </p>
          {result.errors.length > 0 && (
            <div className="text-left p-3 rounded-xl text-xs space-y-1" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)', maxHeight: 120, overflowY: 'auto' }}>
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button
            onClick={onClose}
            className="mt-2 px-5 py-2 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Email Session Schedule" onClose={onClose} width="md">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Students will receive a PDF of the full session schedule for <strong>{className}</strong>.
        </p>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Recipients</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set(students.filter(s => s.email).map(s => s.id)))}
                className="text-xs px-2 py-0.5 rounded"
                style={{ border: '1px solid var(--color-border)', color: '#0BB5C7' }}
              >
                Select All
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs px-2 py-0.5 rounded"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              style={inputStyle}
              placeholder="Search students..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Student list */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {filtered.map(s => {
              const hasEmail = !!s.email
              const isChecked = selected.has(s.id)
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    opacity: hasEmail ? 1 : 0.45,
                    cursor: hasEmail ? 'pointer' : 'not-allowed',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!hasEmail}
                    onChange={() => toggleOne(s.id)}
                    style={{ accentColor: '#0BB5C7' }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {s.name}
                  </span>
                  <span className="text-xs truncate max-w-[160px]" style={{ color: hasEmail ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>
                    {s.email ?? 'No email'}
                  </span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No students match</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {sending && progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>Sending schedules…</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%`, backgroundColor: '#0BB5C7' }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm rounded-xl"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || sendable.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {sending ? 'Sending…' : `Send Schedule (${sendable.length})`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
