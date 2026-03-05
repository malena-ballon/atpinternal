'use client'

import { useState, useMemo } from 'react'
import { Loader2, CheckCircle2, Mail, Search } from 'lucide-react'
import Modal from '@/app/dashboard/components/Modal'
import { emailStudentReport } from '@/app/actions'
import type { StudentStats } from './PerformanceInsights'

interface Props {
  classId: string
  className: string
  studentStats: StudentStats[]
  classPassingPct: number
  onClose: () => void
}

export default function EmailReportsModal({ classId, className, studentStats, classPassingPct, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(studentStats.filter(s => s.student.email).map(s => s.student.id))
  )
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return studentStats
    return studentStats.filter(s => s.student.name.toLowerCase().includes(q) || (s.student.email ?? '').toLowerCase().includes(q))
  }, [studentStats, query])

  const sendable = studentStats.filter(s => s.student.email && selected.has(s.student.id))

  function toggleOne(id: string) {
    const s = studentStats.find(x => x.student.id === id)
    if (!s?.student.email) return  // can't select students without email
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(studentStats.filter(s => s.student.email).map(s => s.student.id)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  async function handleSend() {
    if (!sendable.length) return
    setSending(true)
    setProgress({ done: 0, total: sendable.length })
    let sent = 0
    let skipped = 0

    // Process in batches of 3
    const BATCH = 3
    for (let i = 0; i < sendable.length; i += BATCH) {
      const batch = sendable.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(s => emailStudentReport(s.student.id, classId, classPassingPct))
      )
      for (const r of results) {
        if (r.skipped) skipped++
        else if (r.ok) sent++
      }
      setProgress({ done: Math.min(i + BATCH, sendable.length), total: sendable.length })
    }

    setSending(false)
    setResult({ sent, skipped })
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

  if (result) {
    return (
      <Modal title="Email Reports" onClose={onClose} width="md">
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 size={36} style={{ color: 'var(--color-success)', margin: '0 auto' }} />
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Reports sent!
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {result.sent} sent · {result.skipped} skipped (no email)
          </p>
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
    <Modal title="Email Student Reports" onClose={onClose} width="md">
      <div className="space-y-4">
        {/* Report type */}
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Report Type</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" defaultChecked readOnly style={{ accentColor: '#0BB5C7' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Student Performance Report</span>
          </label>
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Recipients</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid var(--color-border)', color: '#0BB5C7' }}>
                Select All
              </button>
              <button onClick={deselectAll} className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
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
              const hasEmail = !!s.student.email
              const isChecked = selected.has(s.student.id)
              return (
                <label
                  key={s.student.id}
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
                    onChange={() => toggleOne(s.student.id)}
                    style={{ accentColor: '#0BB5C7' }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {s.student.name}
                  </span>
                  <span className="text-xs truncate max-w-[160px]" style={{ color: hasEmail ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>
                    {s.student.email ?? 'No email'}
                  </span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No students match</p>
            )}
          </div>
        </div>

        {/* Progress bar while sending */}
        {sending && progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>Sending reports…</span>
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
            {sending ? 'Sending…' : `Send Reports (${sendable.length})`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
