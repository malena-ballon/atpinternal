import { format, parseISO } from 'date-fns'
import Link from 'next/link'

export interface UpcomingSession {
  id: string
  date: string
  start_time: string
  end_time: string
  subjects: { name: string } | null
  teachers: { name: string } | null
  classes: { name: string } | null
}

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function UpcomingSessionsCard({ sessions }: { sessions: UpcomingSession[] }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Upcoming Sessions
        </h2>
        <Link href="/dashboard/schedule" className="text-xs font-medium" style={{ color: '#0BB5C7' }}>
          View All
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No upcoming sessions scheduled.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div
              key={s.id}
              className="flex gap-3 items-start rounded-xl p-3"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              {/* Date block */}
              <div
                className="shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-2"
                style={{ backgroundColor: 'rgba(11,181,199,0.08)', minWidth: '44px' }}
              >
                <span className="text-xs font-medium uppercase" style={{ color: '#0BB5C7' }}>
                  {format(parseISO(s.date), 'EEE')}
                </span>
                <span className="text-xl font-bold leading-none mt-0.5" style={{ color: '#0BB5C7' }}>
                  {format(parseISO(s.date), 'd')}
                </span>
                <span className="text-xs" style={{ color: '#0BB5C7' }}>
                  {format(parseISO(s.date), 'MMM')}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {s.classes?.name ?? '—'}
                </p>
                {s.subjects?.name && (
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.subjects.name}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {fmt12(s.start_time)} – {fmt12(s.end_time)}
                  </span>
                  {s.teachers?.name && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      · {s.teachers.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
