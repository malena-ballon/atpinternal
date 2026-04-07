// Skeleton matching the activity log page: header, filter bar, timeline entries
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-32 rounded-xl animate-pulse" style={pulse} />
        <div className="h-4 w-56 rounded-lg animate-pulse" style={pulse} />
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1 min-w-[180px] h-9 rounded-xl" style={pulse} />
        <div className="h-9 w-36 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
      </div>

      {/* Activity entries */}
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4" style={{ borderBottom: i < 9 ? '1px solid var(--color-border)' : undefined }}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5" style={pulse} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-4 w-28 rounded" style={pulse} />
                <div className="h-4 w-20 rounded" style={pulse} />
                <div className="h-4 w-32 rounded" style={pulse} />
              </div>
              <div className="h-3 w-48 rounded" style={pulse} />
            </div>
            <div className="h-3 w-20 rounded flex-shrink-0" style={pulse} />
          </div>
        ))}
      </div>
    </div>
  )
}
