// Skeleton matching the dashboard page layout exactly
export default function Loading() {
  const pulse = { backgroundColor: 'var(--color-border)' } as const
  return (
    <div className="p-8 space-y-6" style={{ marginLeft: '240px' }}>
      {/* Page header */}
      <div className="space-y-1.5">
        <div className="h-7 w-32 rounded-xl animate-pulse" style={pulse} />
        <div className="h-4 w-72 rounded-lg animate-pulse" style={pulse} />
      </div>

      {/* OverviewCards — 5 primary cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5 space-y-3 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 rounded" style={pulse} />
                <div className="w-8 h-8 rounded-lg" style={pulse} />
              </div>
              <div className="h-8 w-14 rounded-xl" style={pulse} />
            </div>
          ))}
        </div>
        {/* 5 status chips */}
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-xl px-4 py-3 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', height: '48px' }} />
          ))}
        </div>
      </div>

      {/* Main grid: 3fr + 2fr */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* SessionsPerProgram */}
        <div className="rounded-2xl p-6 space-y-5 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="h-5 w-44 rounded-lg" style={pulse} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 rounded" style={pulse} />
                <div className="h-4 w-16 rounded" style={pulse} />
              </div>
              <div className="h-2.5 rounded-full" style={pulse} />
            </div>
          ))}
        </div>

        {/* Right column: today + upcoming */}
        <div className="flex flex-col gap-6">
          {/* Today's sessions */}
          <div className="rounded-2xl p-5 space-y-4 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="h-5 w-36 rounded-lg" style={pulse} />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex-shrink-0" style={pulse} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 rounded" style={pulse} />
                  <div className="h-3 w-1/2 rounded" style={pulse} />
                </div>
              </div>
            ))}
          </div>
          {/* Upcoming sessions */}
          <div className="rounded-2xl p-5 space-y-4 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="h-5 w-40 rounded-lg" style={pulse} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex-shrink-0" style={pulse} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-2/3 rounded" style={pulse} />
                  <div className="h-3 w-1/3 rounded" style={pulse} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject averages */}
      <div className="rounded-2xl p-6 space-y-4 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="h-5 w-40 rounded-lg" style={pulse} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded" style={pulse} />
              <div className="h-4 w-12 rounded" style={pulse} />
            </div>
            <div className="h-1.5 rounded-full" style={pulse} />
          </div>
        ))}
      </div>
    </div>
  )
}
