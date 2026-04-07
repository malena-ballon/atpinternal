// Skeleton matching the schedule page: header, multi-filter bar, session table
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-40 rounded-xl animate-pulse" style={pulse} />
          <div className="h-4 w-32 rounded-lg animate-pulse" style={pulse} />
        </div>
        <div className="h-9 w-32 rounded-xl animate-pulse" style={pulse} />
      </div>

      {/* Multi-filter bar */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1 min-w-[180px] h-9 rounded-xl" style={pulse} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-xl" style={{ ...pulse, width: `${90 + i * 10}px` }} />
        ))}
        <div className="h-9 w-28 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
      </div>

      {/* Sessions table */}
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <div className="w-5 h-5 rounded" style={pulse} />
          <div className="h-3.5 w-20 rounded" style={pulse} />
          <div className="h-3.5 w-24 rounded" style={pulse} />
          <div className="h-3.5 w-32 rounded" style={pulse} />
          <div className="h-3.5 w-24 rounded" style={pulse} />
          <div className="h-3.5 w-20 rounded ml-auto" style={pulse} />
        </div>
        {/* Session rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: i < 7 ? '1px solid var(--color-border)' : undefined }}>
            <div className="w-5 h-5 rounded" style={pulse} />
            <div className="space-y-1 w-24">
              <div className="h-4 w-24 rounded" style={pulse} />
              <div className="h-3 w-20 rounded" style={pulse} />
            </div>
            <div className="h-4 w-32 rounded" style={pulse} />
            <div className="h-4 w-28 rounded" style={pulse} />
            <div className="h-6 w-20 rounded-full" style={pulse} />
            <div className="h-6 w-6 rounded-full ml-auto" style={pulse} />
          </div>
        ))}
      </div>
    </div>
  )
}
