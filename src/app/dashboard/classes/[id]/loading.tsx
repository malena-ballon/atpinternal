// Skeleton matching the class detail page: breadcrumb, tabs, content area
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-14 rounded animate-pulse" style={pulse} />
        <div className="h-4 w-3 rounded animate-pulse" style={pulse} />
        <div className="h-4 w-36 rounded animate-pulse" style={pulse} />
      </div>

      {/* Class name header */}
      <div className="space-y-2 animate-pulse">
        <div className="h-8 w-64 rounded-xl" style={pulse} />
        <div className="h-4 w-48 rounded-lg" style={pulse} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 animate-pulse">
        {[80, 100, 80, 110, 70, 120].map((w, i) => (
          <div key={i} className="h-9 rounded-xl" style={{ ...pulse, width: `${w}px` }} />
        ))}
      </div>

      {/* Tab content — sessions spreadsheet-like */}
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Toolbar */}
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <div className="h-8 w-28 rounded-xl" style={pulse} />
          <div className="h-8 w-24 rounded-xl" style={pulse} />
          <div className="ml-auto h-8 w-28 rounded-xl" style={pulse} />
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-0" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          {[48, 110, 130, 120, 100, 100, 90, 80].map((w, i) => (
            <div key={i} className="px-4 py-3 flex-shrink-0" style={{ width: `${w}px` }}>
              <div className="h-3 rounded" style={{ ...pulse, width: '70%' }} />
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center" style={{ borderBottom: i < 5 ? '1px solid var(--color-border)' : undefined }}>
            {[48, 110, 130, 120, 100, 100, 90, 80].map((w, j) => (
              <div key={j} className="px-4 py-3.5 flex-shrink-0" style={{ width: `${w}px` }}>
                <div className="h-4 rounded" style={{ ...pulse, width: j === 1 ? '90%' : '60%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
