export default function Loading() {
  return (
    <div className="p-8 space-y-6" style={{ marginLeft: '240px' }}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
        <div className="h-4 w-64 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 space-y-3 animate-pulse"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="h-4 w-20 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
            <div className="h-8 w-16 rounded-xl" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* Sessions per program */}
        <div
          className="rounded-2xl p-6 space-y-4 animate-pulse"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="h-5 w-44 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                <div className="h-4 w-12 rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {[1, 2].map(n => (
            <div
              key={n}
              className="rounded-2xl p-6 space-y-3 animate-pulse"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="h-5 w-36 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                    <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
