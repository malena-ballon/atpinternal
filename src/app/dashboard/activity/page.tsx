import { createServiceClient } from '@/utils/supabase/service'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import {
  Activity, User, FileEdit, BookOpen, CalendarDays, ClipboardList,
  Trash2, Download, Mail, Plus, Pencil, Upload, FileText, Users,
} from 'lucide-react'

const ACTION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  // Teachers
  added_teacher:        { label: 'Added Teacher',         color: '#16a34a', icon: Plus },
  updated_profile:      { label: 'Updated Teacher',       color: '#0BB5C7', icon: Pencil },
  deleted_teacher:      { label: 'Deleted Teacher',       color: '#DC2626', icon: Trash2 },
  // Classes
  added_class:          { label: 'Added Class',           color: '#16a34a', icon: Plus },
  updated_class:        { label: 'Updated Class',         color: '#0BB5C7', icon: Pencil },
  deleted_class:        { label: 'Deleted Class',         color: '#DC2626', icon: Trash2 },
  deleted_classes:      { label: 'Deleted Classes',       color: '#DC2626', icon: Trash2 },
  // Sessions
  saved_sessions:       { label: 'Saved Sessions',        color: '#D97706', icon: CalendarDays },
  deleted_sessions:     { label: 'Deleted Sessions',      color: '#DC2626', icon: Trash2 },
  // Students
  updated_students:     { label: 'Updated Students',      color: '#7C3AED', icon: Users },
  deleted_students:     { label: 'Deleted Students',      color: '#DC2626', icon: Trash2 },
  // Exams & Scores
  added_exam:           { label: 'Added Exam',            color: '#16a34a', icon: Plus },
  updated_exam:         { label: 'Updated Exam',          color: '#0BB5C7', icon: Pencil },
  deleted_exam:         { label: 'Deleted Exam',          color: '#DC2626', icon: Trash2 },
  deleted_exams:        { label: 'Deleted Exams',         color: '#DC2626', icon: Trash2 },
  added_score:          { label: 'Imported Scores',       color: '#7C3AED', icon: Upload },
  // Exports
  exported_pdf:         { label: 'Exported PDF',          color: '#0BB5C7', icon: Download },
  exported_csv:         { label: 'Exported CSV',          color: '#0BB5C7', icon: FileText },
  // Emails
  sent_email:           { label: 'Sent Email',            color: '#16a34a', icon: Mail },
}

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action.replace(/_/g, ' '), color: 'var(--color-text-muted)', icon: Activity }
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: format(d, 'MMM d, yyyy'),
    time: format(d, 'h:mm a'),
  }
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const svc = createServiceClient()
  const { data: logs } = await svc
    .from('activity_logs')
    .select('id, user_name, user_role, action, entity_type, entity_id, entity_name, description, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Activity Log</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          Full audit trail of actions by teachers and admins
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {!logs?.length ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No activity recorded yet.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                {['User', 'Action', 'Target', 'Details', 'Date', 'Time'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const meta = getActionMeta(log.action)
                const Icon = meta.icon
                const { date, time } = formatDateTime(log.created_at)
                return (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>

                    {/* Teacher / User */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: log.user_role === 'admin' ? 'rgba(124,58,237,0.12)' : 'rgba(11,181,199,0.12)',
                            color: log.user_role === 'admin' ? '#7C3AED' : '#0BB5C7',
                          }}>
                          {log.user_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {log.user_name}
                          </p>
                          <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                            {log.user_role ?? 'teacher'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Action badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full w-fit"
                        style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    </td>

                    {/* Target entity */}
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {log.entity_name
                        ? <span>{log.entity_name}<span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>({log.entity_type})</span></span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', maxWidth: '280px' }}>
                      <span className="line-clamp-2">{log.description ?? '—'}</span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                      {date}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      {time}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
