export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
      {children}
    </div>
  )
}
