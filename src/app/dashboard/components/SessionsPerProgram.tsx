import Link from 'next/link'

interface Program {
  id: string
  name: string
  total: number
  upcoming: number
  done: number
  cancelled: number
  completionPct: number
}

function ProgramCard({ p }: { p: Program }) {
  const statusLabel =
    p.total === 0 ? 'Upcoming'
    : p.completionPct === 100 ? 'Completed'
    : 'Active'

  const statusColor =
    statusLabel === 'Completed' ? '#16A34A'
    : statusLabel === 'Active' ? '#0BB5C7'
    : '#D97706'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
          {p.name}
        </h3>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Completion</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {p.completionPct}% ({p.done}/{p.total})
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${p.completionPct}%`,
              backgroundColor: p.completionPct === 100 ? '#16A34A' : '#3DD4E6',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function SessionsPerProgram({ programs }: { programs: Program[] }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Sessions Per Program
        </h2>
        <Link
          href="/dashboard/classes"
          className="text-xs font-medium"
          style={{ color: '#0BB5C7' }}
        >
          View All
        </Link>
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          No active programs yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {programs.map(p => <ProgramCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  )
}
