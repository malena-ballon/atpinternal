import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import Image from 'next/image'
import { createServiceClient } from '@/utils/supabase/service'
import { Clock } from 'lucide-react'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default async function PublicSchedulePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const supabase = createServiceClient()

  const [{ data: cls }, { data: sessions }] = await Promise.all([
    supabase.from('classes').select('id, name, status').eq('id', classId).single(),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, topic, subjects(name)')
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Acadgenius Tutorial Powerhouse"
            width={36}
            height={36}
            className="rounded-lg object-cover"
          />
          <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Acadgenius Tutorial Powerhouse
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {cls.name}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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
                  {['Date', 'Day', 'Time', 'Subject', 'Topic'].map(h => (
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
                  const subject = (s.subjects as unknown as { name: string } | null)
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
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {(s as { topic?: string }).topic || '—'}
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
          Acadgenius Tutorial Powerhouse · Schedule is read-only and updates automatically
        </p>
      </main>
    </div>
  )
}
