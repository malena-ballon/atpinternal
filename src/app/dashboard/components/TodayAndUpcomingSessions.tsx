import { Clock, User } from 'lucide-react'
import Link from 'next/link'

export interface SessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  student_count: number
  zoom_link: string | null
  subjects: { name: string } | null
  teachers: { name: string } | null
  classes: { name: string } | null
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  scheduled:   { label: 'Confirmed',   bg: 'rgba(34,197,94,0.08)',  color: '#16A34A', border: '#22C55E' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.08)', color: '#D97706', border: '#F59E0B' },
  completed:   { label: 'Done',        bg: 'rgba(34,197,94,0.08)',  color: '#16A34A', border: '#22C55E' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(239,68,68,0.08)',  color: '#DC2626', border: '#EF4444' },
  rescheduled: { label: 'Rescheduled', bg: 'rgba(99,102,241,0.08)', color: '#4F46E5', border: '#6366F1' },
}

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function SessionCard({ s }: { s: SessionRow }) {
  const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.scheduled
  return (
    <div
      className="flex gap-3 rounded-xl p-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${cfg.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {s.subjects?.name ?? s.classes?.name ?? 'Unknown'}
          </p>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wide"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {fmt12(s.start_time)} – {fmt12(s.end_time)}
          </span>
          {s.teachers?.name && (
            <span className="flex items-center gap-1">
              <User size={11} />
              {s.teachers.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TodayAndUpcomingSessions({ todaySessions }: { todaySessions: SessionRow[] }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Today&apos;s Sessions
        </h2>
        <Link href="/dashboard/schedule" className="text-xs font-medium" style={{ color: '#0BB5C7' }}>
          View All
        </Link>
      </div>

      {todaySessions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No sessions scheduled for today.
        </p>
      ) : (
        <div className="space-y-3">
          {todaySessions.map(s => <SessionCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}
