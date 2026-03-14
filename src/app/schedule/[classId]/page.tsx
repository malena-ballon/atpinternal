import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createServiceClient } from '@/utils/supabase/service'
import { BookOpen, CalendarDays } from 'lucide-react'
import PublicSessionsTable from './PublicSessionsTable'

export default async function PublicSchedulePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const supabase = createServiceClient()

  const [{ data: cls }, { data: sessions }, { data: clsExtra }, { data: classSubjects }] = await Promise.all([
    supabase.from('classes').select('id, name, status').eq('id', classId).single(),
    supabase.from('sessions')
      .select('id, date, start_time, end_time, status, topic, subject_ids, subjects(name)')
      .eq('class_id', classId)
      .in('status', ['scheduled', 'in_progress', 'completed'])
      .order('date')
      .order('start_time'),
    supabase.from('classes').select('public_notes, public_notes_position').eq('id', classId).single(),
    supabase.from('subjects').select('id, name').eq('class_id', classId),
  ])
  const subjects = (classSubjects ?? []) as { id: string; name: string }[]

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
              {sessions.filter(s => s.status === 'scheduled' || s.status === 'in_progress').length} upcoming session{sessions.filter(s => s.status === 'scheduled' || s.status === 'in_progress').length !== 1 ? 's' : ''}
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
            <PublicSessionsTable
              sessions={sessions as unknown as { id: string; date: string; start_time: string; end_time: string; status: string; topic?: string | null; subject_ids?: string[] | null; subjects?: { name: string } | null }[]}
              subjects={subjects}
            />
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
