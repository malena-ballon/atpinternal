import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { createServiceClient } from '@/utils/supabase/service'
import { GraduationCap, Clock } from 'lucide-react'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: 'Upcoming',    color: '#0BB5C7', bg: 'rgba(61,212,230,0.1)' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: 'rgba(245,158,11,0.1)' },
}

export default async function PublicSchedulePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const supabase = createServiceClient()

  const [{ data: cls }, { data: sessions }] = await Promise.all([
    supabase.from('classes').select('id, name, status').eq('id', classId).single(),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, subjects(name)')
      .eq('class_id', classId)
      .in('status', ['scheduled', 'in_progress'])
      .order('date')
      .order('start_time'),
  ])

  if (!cls || cls.status !== 'active') notFound()

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(61,212,230,0.12)' }}
          >
            <GraduationCap size={18} style={{ color: '#0BB5C7' }} />
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Acadgenius
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {cls.name}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {cls.name} — Schedule
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Schedule auto-updates in real time.
          </p>
        </div>

        {sessions === null || sessions.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No upcoming sessions scheduled.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  {['Date', 'Day', 'Time', 'Subject', 'Status'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const cfg = STATUS_LABEL[s.status] ?? STATUS_LABEL.scheduled
                  const subject = (s.subjects as { name: string } | null)
                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                    >
                      <td className="px-5 py-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {format(parseISO(s.date), 'MMMM d, yyyy')}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {format(parseISO(s.date), 'EEEE')}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
                          {fmt12(s.start_time)} – {fmt12(s.end_time)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {subject?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-center pb-4" style={{ color: 'var(--color-text-muted)' }}>
          Powered by Acadgenius · Schedule is read-only and updates automatically
        </p>
      </main>
    </div>
  )
}
