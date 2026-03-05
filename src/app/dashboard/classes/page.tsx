import { createClient } from '@/utils/supabase/server'
import type { ClassSummary } from '@/types'
import ClassesTable from './components/ClassesTable'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name, status, zoom_link, subjects(id), sessions(id, status)')
    .order('created_at', { ascending: false })

  const classes: ClassSummary[] = (classesData ?? []).map((c) => {
    const sessions = (c.sessions as { status: string }[]) ?? []
    const total = sessions.length
    const done = sessions.filter(s => s.status === 'completed').length
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      rate: null,
      zoom_link: c.zoom_link ?? null,
      subjectsCount: (c.subjects as unknown[]).length,
      sessionsCount: total,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Classes</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Manage programs, subjects, and schedule links
        </p>
      </div>
      <ClassesTable initialClasses={classes} />
    </div>
  )
}
