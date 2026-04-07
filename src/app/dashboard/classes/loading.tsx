// Skeleton matching the classes page: header, search bar, card grid
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-24 rounded-xl animate-pulse" style={pulse} />
          <div className="h-4 w-48 rounded-lg animate-pulse" style={pulse} />
        </div>
        <div className="h-9 w-32 rounded-xl animate-pulse" style={pulse} />
      </div>

      {/* Search + filter bar */}
      <div className="rounded-2xl p-4 flex items-center gap-3 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1 h-9 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
        <div className="h-9 w-28 rounded-xl" style={pulse} />
      </div>

      {/* Classes table */}
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <div className="w-5 h-5 rounded" style={pulse} />
          <div className="h-3.5 w-32 rounded" style={pulse} />
          <div className="h-3.5 w-20 rounded ml-auto" style={pulse} />
          <div className="h-3.5 w-16 rounded" style={pulse} />
          <div className="h-3.5 w-16 rounded" style={pulse} />
          <div className="h-3.5 w-20 rounded" style={pulse} />
        </div>
        {/* Rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < 6 ? '1px solid var(--color-border)' : undefined }}>
            <div className="w-5 h-5 rounded" style={pulse} />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded" style={pulse} />
              <div className="h-3 w-32 rounded" style={pulse} />
            </div>
            <div className="h-6 w-16 rounded-full" style={pulse} />
            <div className="h-4 w-10 rounded" style={pulse} />
            <div className="h-4 w-10 rounded" style={pulse} />
            <div className="h-4 w-20 rounded" style={pulse} />
            <div className="w-7 h-7 rounded-lg" style={pulse} />
          </div>
        ))}
      </div>
    </div>
  )
}
