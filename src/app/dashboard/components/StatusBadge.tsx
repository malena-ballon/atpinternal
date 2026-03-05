import type { SessionStatus, ClassStatus } from '@/types'

type Status = SessionStatus | ClassStatus

const CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  scheduled:   { label: 'Upcoming',    bg: 'rgba(61,212,230,0.1)',   color: '#0BB5C7' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.1)',   color: '#D97706' },
  completed:   { label: 'Done',        bg: 'rgba(34,197,94,0.1)',    color: '#16A34A' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
  rescheduled: { label: 'Rescheduled', bg: 'rgba(99,102,241,0.1)',   color: '#4F46E5' },
  active:      { label: 'Active',      bg: 'rgba(61,212,230,0.1)',   color: '#0BB5C7' },
  inactive:    { label: 'Inactive',    bg: 'rgba(245,158,11,0.1)',   color: '#D97706' },
  archived:    { label: 'Archived',    bg: 'rgba(100,116,139,0.12)', color: '#64748B' },
}

interface Props {
  status: Status
  size?: 'sm' | 'default'
}

export default function StatusBadge({ status, size = 'default' }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.archived
  return (
    <span
      className="inline-flex items-center font-semibold rounded-full"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: size === 'sm' ? '11px' : '12px',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        letterSpacing: '0.02em',
      }}
    >
      {cfg.label}
    </span>
  )
}
