export default function Loading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      {/* 1. Circle is first */}
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      
      {/* 2. Text is second (appears below) */}
      <p className="text-lg font-medium animate-pulse" style={{ color: 'var(--color-text-primary)' }}>Loading...</p>
    </div>
  );
}