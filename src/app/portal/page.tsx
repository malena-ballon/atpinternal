import Image from 'next/image'
import { getPortalClasses, getPortalTheme } from '@/app/actions'
import PortalClient from './PortalClient'

export default async function StudentPortalPage() {
  const [classes, theme] = await Promise.all([getPortalClasses(), getPortalTheme()])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Image src="/logo.jpg" alt="Acadgenius" width={32} height={32} className="rounded-lg" />
          <div>
            <p className="text-xs font-bold" style={{ color: '#1E3A5F' }}>Acadgenius Tutorial Powerhouse</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Student Performance Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <PortalClient classes={classes} theme={theme} />
      </main>
    </div>
  )
}
