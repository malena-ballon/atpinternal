// Skeleton that exactly mirrors the dashboard page layout and component dimensions
export default function Loading() {
  const s = { backgroundColor: 'var(--color-border)' } as const
  const surface = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' } as const

  return (
    <div className="p-8 space-y-6" style={{ marginLeft: '240px' }}>

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="h-7 w-28 rounded-xl animate-pulse" style={s} />
        <div className="h-4 w-72 rounded-lg animate-pulse" style={s} />
      </div>

      {/* ── OverviewCards ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* 5 primary stat cards: rounded-xl p-5, icon w-8 h-8, value text-3xl */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5 space-y-3 animate-pulse" style={surface}>
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded" style={s} />
                <div className="w-8 h-8 rounded-lg" style={s} />
              </div>
              {/* text-3xl number */}
              <div className="h-9 w-16 rounded-lg" style={s} />
              {/* sub-line (only first card has one) */}
              {i === 0 && <div className="h-3.5 w-32 rounded" style={s} />}
            </div>
          ))}
        </div>

        {/* 5 status chips: flex-1 rounded-xl px-4 py-3 h≈48px */}
        <div className="flex gap-3">
          {['Upcoming', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled'].map(label => (
            <div
              key={label}
              className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse"
              style={surface}
            >
              <div className="h-3.5 rounded" style={{ ...s, width: `${label.length * 6}px` }} />
              <div className="h-5 w-6 rounded" style={s} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid: 3fr + 2fr ───────────────────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '3fr 2fr' }}>

        {/* SessionsPerProgram: rounded-2xl p-6, inner grid-cols-2 of ProgramCards */}
        <div className="rounded-2xl p-6 animate-pulse" style={surface}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="h-5 w-44 rounded-lg" style={s} />
            <div className="h-4 w-14 rounded" style={s} />
          </div>
          {/* 2-col grid of program cards: rounded-xl p-5 */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 space-y-4" style={{ border: '1px solid var(--color-border)' }}>
                {/* Title + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="h-4 rounded flex-1" style={s} />
                  <div className="h-6 w-16 rounded-full flex-shrink-0" style={s} />
                </div>
                {/* Completion row + progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-20 rounded" style={s} />
                    <div className="h-3.5 w-20 rounded" style={s} />
                  </div>
                  <div className="h-1.5 w-full rounded-full" style={s} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">

          {/* TodayAndUpcomingSessions: rounded-2xl p-6, session cards with left border */}
          <div className="rounded-2xl p-6 animate-pulse" style={surface}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-36 rounded-lg" style={s} />
              <div className="h-4 w-14 rounded" style={s} />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                /* Session card: flex gap-3 rounded-xl p-4, left colored border */
                <div
                  key={i}
                  className="flex gap-3 rounded-xl p-4"
                  style={{ border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-border)' }}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-4 w-28 rounded" style={s} />
                      <div className="h-5 w-16 rounded-md" style={s} />
                    </div>
                    <div className="flex gap-3">
                      <div className="h-3.5 w-24 rounded" style={s} />
                      <div className="h-3.5 w-20 rounded" style={s} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UpcomingSessionsCard: rounded-2xl p-6, date block (44px) + content */}
          <div className="rounded-2xl p-6 animate-pulse" style={surface}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-40 rounded-lg" style={s} />
              <div className="h-4 w-14 rounded" style={s} />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                /* Item: flex gap-3 rounded-xl p-3 */
                <div
                  key={i}
                  className="flex gap-3 items-start rounded-xl p-3"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  {/* Date block: minWidth 44px, ~62px tall */}
                  <div className="rounded-lg flex-shrink-0" style={{ ...s, width: '44px', height: '62px' }} />
                  {/* Content */}
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-4 w-3/4 rounded" style={s} />
                    <div className="h-3.5 w-1/2 rounded" style={s} />
                    <div className="h-3 w-2/3 rounded" style={s} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SubjectAverages: rounded-2xl ───────────────────────────── */}
      <div className="rounded-2xl animate-pulse" style={surface}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="space-y-1.5">
            <div className="h-4 w-40 rounded-lg" style={s} />
            <div className="h-3.5 w-24 rounded" style={s} />
          </div>
          <div className="h-8 w-32 rounded-xl" style={s} />
        </div>
        <div className="p-5 space-y-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-32 rounded" style={s} />
                  <div className="h-3 w-24 rounded" style={s} />
                </div>
                <div className="h-4 w-12 rounded" style={s} />
              </div>
              <div className="h-1.5 w-full rounded-full" style={s} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
