// Skeleton matching the teachers page: header, tabs (Teachers/Pending/Invited/Admins), table
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-28 rounded-xl animate-pulse" style={pulse} />
        <div className="h-4 w-64 rounded-lg animate-pulse" style={pulse} />
      </div>

      {/* Tab bar + Add Teacher button */}
      <div className="rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Tabs + action */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 rounded-xl" style={{ ...pulse, width: `${60 + i * 8}px` }} />
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-xl" style={pulse} />
            <div className="h-8 w-28 rounded-xl" style={pulse} />
          </div>
        </div>

        {/* Search row */}
        <div className="px-5 py-3 flex gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex-1 h-9 rounded-xl" style={pulse} />
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <div className="h-3.5 w-36 rounded" style={pulse} />
          <div className="h-3.5 w-40 rounded" style={pulse} />
          <div className="h-3.5 w-28 rounded" style={pulse} />
          <div className="h-3.5 w-20 rounded ml-auto" style={pulse} />
        </div>

        {/* Teacher rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < 5 ? '1px solid var(--color-border)' : undefined }}>
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={pulse} />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded" style={pulse} />
              <div className="h-3 w-28 rounded" style={pulse} />
            </div>
            <div className="h-3 w-48 rounded" style={pulse} />
            <div className="flex gap-1 ml-auto">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-5 w-10 rounded-md" style={pulse} />
              ))}
            </div>
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded-lg" style={pulse} />
              <div className="w-8 h-8 rounded-lg" style={pulse} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
