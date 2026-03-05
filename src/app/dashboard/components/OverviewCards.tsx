import {
  Calendar,
  BookOpen,
  UserCheck,
  Users,
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface StatusCounts {
  scheduled: number
  in_progress: number
  completed: number
  cancelled: number
  rescheduled: number
}

interface Props {
  totalSessions: number
  thisMonthSessions: number
  statusCounts: StatusCounts
  activePrograms: number
  activeTeachers: number
  enrolledStudents: number
  pendingApprovals: number
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  action,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub?: string
  highlight?: boolean
  action?: string
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        backgroundColor: highlight ? 'rgba(61,212,230,0.06)' : 'var(--color-surface)',
        border: `1px solid ${highlight ? 'rgba(61,212,230,0.25)' : 'var(--color-border)'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: highlight ? '#0BB5C7' : 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: highlight ? 'rgba(61,212,230,0.12)' : 'var(--color-bg)' }}
        >
          <Icon size={16} style={{ color: highlight ? '#0BB5C7' : 'var(--color-text-muted)' }} />
        </div>
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
        {value.toLocaleString()}
      </div>
      {sub && (
        <div className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
          <TrendingUp size={12} />
          {sub}
        </div>
      )}
      {action && (
        <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
          <AlertCircle size={12} />
          {action}
        </div>
      )}
    </div>
  )
}

function StatusChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}

export default function OverviewCards({
  totalSessions,
  thisMonthSessions,
  statusCounts,
  activePrograms,
  activeTeachers,
  enrolledStudents,
  pendingApprovals,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Primary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card
          icon={Calendar}
          label="Total Sessions"
          value={totalSessions}
          sub={`+${thisMonthSessions} this month`}
        />
        <Card icon={BookOpen} label="Active Programs" value={activePrograms} />
        <Card icon={UserCheck} label="Active Teachers" value={activeTeachers} />
        <Card icon={Users} label="Enrolled Students" value={enrolledStudents} />
        <Card
          icon={Bell}
          label="Pending Approvals"
          value={pendingApprovals}
          highlight={pendingApprovals > 0}
          action={pendingApprovals > 0 ? 'Action required' : undefined}
        />
      </div>

      {/* Session status chips */}
      <div className="flex gap-3">
        <StatusChip label="Upcoming" value={statusCounts.scheduled} color="#0BB5C7" />
        <StatusChip label="In Progress" value={statusCounts.in_progress} color="#D97706" />
        <StatusChip label="Completed" value={statusCounts.completed} color="#16A34A" />
        <StatusChip label="Cancelled" value={statusCounts.cancelled} color="#DC2626" />
        <StatusChip label="Rescheduled" value={statusCounts.rescheduled} color="#4F46E5" />
      </div>
    </div>
  )
}
