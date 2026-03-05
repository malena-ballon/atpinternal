'use client'

import { Pencil, Copy, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { SessionRow, SessionStatus } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const BULK_STATUSES: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
]

interface Props {
  sessions: SessionRow[]
  selected: Set<string>
  onSelectToggle: (id: string) => void
  onSelectAll: () => void
  onEdit: (session: SessionRow) => void
  onDuplicate: (session: SessionRow) => void
  onCancel: (id: string) => void
  onBulkStatusChange: (ids: string[], status: SessionStatus) => void
  editMode: boolean
}

export default function ScheduleTable({
  sessions, selected, onSelectToggle, onSelectAll,
  onEdit, onDuplicate, onCancel, onBulkStatusChange, editMode,
}: Props) {
  const allSelected = sessions.length > 0 && selected.size === sessions.length

  return (
    <div>
      {/* Bulk action bar */}
      {editMode && selected.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3 text-sm"
          style={{ backgroundColor: 'rgba(61,212,230,0.08)', border: '1px solid rgba(61,212,230,0.2)' }}
        >
          <span className="font-medium" style={{ color: '#0BB5C7' }}>
            {selected.size} selected
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Set status:</span>
          <select
            className="text-sm rounded-lg px-2 py-1 outline-none"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            onChange={e => {
              if (e.target.value) {
                onBulkStatusChange(Array.from(selected), e.target.value as SessionStatus)
                e.target.value = ''
              }
            }}
          >
            <option value="">Choose status...</option>
            {BULK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            className="ml-auto text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => onSelectAll()}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {sessions.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No sessions match your filters.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {editMode && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onSelectAll}
                      className="rounded"
                    />
                  </th>
                )}
                {['Date', 'Day', 'Time', 'Subject', 'Class', 'Teacher', 'Status', 'Students', ...(editMode ? [''] : [])].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: editMode && selected.has(s.id) ? 'rgba(61,212,230,0.03)' : 'transparent',
                  }}
                >
                  {editMode && (
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => onSelectToggle(s.id)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {format(parseISO(s.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {format(parseISO(s.date), 'EEE')}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {fmt12(s.start_time)} – {fmt12(s.end_time)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {s.subjects?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.classes?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.teachers?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status as SessionStatus} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {s.student_count > 0 ? s.student_count : '—'}
                  </td>
                  {editMode && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(s)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDuplicate(s)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }} title="Duplicate">
                          <Copy size={13} />
                        </button>
                        {s.status !== 'cancelled' && (
                          <button onClick={() => onCancel(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--color-danger)' }} title="Cancel">
                            <XCircle size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
