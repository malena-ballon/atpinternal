// Skeleton matching the email page: header, two-column inbox+detail layout
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-20 rounded-xl animate-pulse" style={pulse} />
          <div className="h-4 w-44 rounded-lg animate-pulse" style={pulse} />
        </div>
        <div className="h-9 w-36 rounded-xl animate-pulse" style={pulse} />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '280px 1fr', height: '600px' }}>
        {/* Inbox list */}
        <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="h-4 w-20 rounded" style={pulse} />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-1.5" style={{ borderBottom: i < 7 ? '1px solid var(--color-border)' : undefined }}>
              <div className="flex justify-between">
                <div className="h-3.5 w-28 rounded" style={pulse} />
                <div className="h-3 w-14 rounded" style={pulse} />
              </div>
              <div className="h-3 w-40 rounded" style={pulse} />
              <div className="h-3 w-32 rounded" style={pulse} />
            </div>
          ))}
        </div>

        {/* Email detail panel */}
        <div className="rounded-2xl p-6 space-y-5 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="space-y-2">
            <div className="h-6 w-3/4 rounded-xl" style={pulse} />
            <div className="flex gap-3">
              <div className="h-4 w-32 rounded" style={pulse} />
              <div className="h-4 w-24 rounded" style={pulse} />
            </div>
          </div>
          <div className="h-px w-full" style={pulse} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 rounded" style={{ ...pulse, width: `${60 + Math.round(Math.sin(i * 1.5) * 20 + 20)}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
