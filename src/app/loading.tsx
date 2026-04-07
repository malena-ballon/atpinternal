export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
      <div className="w-full max-w-sm space-y-4 px-8">
        <div className="h-8 w-48 rounded-xl animate-pulse mx-auto" style={{ backgroundColor: '#e2e8f0' }} />
        <div className="space-y-3">
          <div className="h-4 rounded-lg animate-pulse" style={{ backgroundColor: '#e2e8f0' }} />
          <div className="h-4 rounded-lg animate-pulse w-3/4" style={{ backgroundColor: '#e2e8f0' }} />
          <div className="h-4 rounded-lg animate-pulse w-1/2" style={{ backgroundColor: '#e2e8f0' }} />
        </div>
      </div>
    </div>
  )
}
