import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import Image from 'next/image'
import { createServiceClient } from '@/utils/supabase/service'
import { Clock, BookOpen, CalendarDays } from 'lucide-react'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default async function PublicSchedulePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const supabase = createServiceClient()

  const [{ data: cls }, { data: sessions }, { data: clsExtra }] = await Promise.all([
    supabase.from('classes').select('id, name, status').eq('id', classId).single(),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, topic, subjects(name)')
      .eq('class_id', classId)
      .in('status', ['scheduled', 'in_progress'])
      .order('date')
      .order('start_time'),
    supabase.from('classes').select('public_notes, public_notes_position').eq('id', classId).single(),
  ])

  if (!cls || cls.status !== 'active') notFound()

  const extra = clsExtra as { public_notes?: string | null; public_notes_position?: string | null } | null
  const publicNotes = extra?.public_notes ?? null
  const notesPosition = extra?.public_notes_position === 'above' ? 'above' : 'below'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Acadgenius Tutorial Powerhouse"
            width={36}
            height={36}
            className="rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-gray-900">Acadgenius Tutorial Powerhouse</p>
            <p className="text-xs text-gray-500 truncate">{cls.name}</p>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg, #0A1045 0%, #0f2060 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(61,212,230,0.15)' }}>
              <CalendarDays size={24} style={{ color: '#3DD4E6' }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{cls.name}</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Upcoming session schedule · updates automatically
              </p>
            </div>
          </div>

          {/* Session count pill */}
          {sessions && sessions.length > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(61,212,230,0.15)', color: '#3DD4E6' }}>
              <BookOpen size={12} />
              {sessions.length} upcoming session{sessions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-3">

        {/* Admin notes — above */}
        {publicNotes && notesPosition === 'above' && (
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Notes from Admin</p>
            <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: publicNotes }} />
          </div>
        )}

        {!sessions || sessions.length === 0 ? (
          <div className="rounded-2xl p-10 text-center bg-white shadow-sm border border-gray-100">
            <CalendarDays size={32} className="mx-auto mb-3" style={{ color: '#cbd5e1' }} />
            <p className="text-sm font-medium text-gray-500">No upcoming sessions scheduled yet.</p>
            <p className="text-xs text-gray-400 mt-1">Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on small screens */}
            <div className="hidden sm:block rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                    {['#', 'Date', 'Day', 'Time', 'Subject', 'Topic'].map(h => (
                      <th key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => {
                    const subject = (s.subjects as unknown as { name: string } | null)
                    const topic = (s as { topic?: string }).topic
                    const isLast = i === sessions.length - 1
                    return (
                      <tr key={s.id}
                        className="hover:bg-blue-50/30 transition-colors"
                        style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                        <td className="px-4 py-3.5 text-xs font-bold text-gray-300 w-8">{i + 1}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">
                          {format(parseISO(s.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-500">
                          {format(parseISO(s.date), 'EEEE')}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">
                          <span className="flex items-center gap-1.5">
                            <Clock size={11} className="text-gray-400 shrink-0" />
                            {fmt12(s.start_time)} – {fmt12(s.end_time)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {subject?.name
                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0891b2' }}>
                                {subject.name}
                              </span>
                            : <span className="text-sm text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[200px]">
                          <span className="line-clamp-2">{topic || <span className="text-gray-300">—</span>}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — shown only on small screens */}
            <div className="sm:hidden space-y-3">
              {sessions.map((s, i) => {
                const subject = (s.subjects as unknown as { name: string } | null)
                const topic = (s as { topic?: string }).topic
                return (
                  <div key={s.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    {/* Top row: number + date */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {format(parseISO(s.date), 'MMMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-400">{format(parseISO(s.date), 'EEEE')}</p>
                        </div>
                      </div>
                      {subject?.name && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                          style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0891b2' }}>
                          {subject.name}
                        </span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                      <Clock size={11} className="text-gray-400" />
                      {fmt12(s.start_time)} – {fmt12(s.end_time)}
                    </div>

                    {/* Topic */}
                    {topic && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                        <span className="font-medium text-gray-400 uppercase tracking-wide text-[10px]">Topic · </span>
                        {topic}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Admin notes — below */}
        {publicNotes && notesPosition === 'below' && (
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Notes from Admin</p>
            <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: publicNotes }} />
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-center py-4 text-gray-400">
          Acadgenius Tutorial Powerhouse · This schedule is read-only and updates automatically
        </p>
      </main>
    </div>
  )
}
