// Skeleton matching the notebook page: header, toolbar, editor body
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-28 rounded-xl animate-pulse" style={pulse} />
          <div className="h-4 w-52 rounded-lg animate-pulse" style={pulse} />
        </div>
        <div className="h-9 w-24 rounded-xl animate-pulse" style={pulse} />
      </div>

      {/* Editor card */}
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Toolbar */}
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-7 h-7 rounded-lg" style={pulse} />
          ))}
          <div className="mx-2 w-px h-5" style={pulse} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-7 h-7 rounded-lg" style={pulse} />
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-3" style={{ minHeight: '460px' }}>
          <div className="h-6 w-1/2 rounded-xl" style={pulse} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded" style={{ ...pulse, width: `${55 + Math.round(Math.sin(i) * 20 + 30)}%` }} />
          ))}
          <div className="h-4 w-1/3 rounded mt-6" style={pulse} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded" style={{ ...pulse, width: `${40 + Math.round(Math.cos(i) * 15 + 30)}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
