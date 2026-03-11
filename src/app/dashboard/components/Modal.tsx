'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: 'md' | 'lg' | 'xl' | '2xl'
}

const widthMap = { md: '480px', lg: '600px', xl: '720px', '2xl': '960px' }

export default function Modal({ title, onClose, children, width = 'md' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl flex flex-col"
        style={{
          maxWidth: widthMap[width],
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="p-6 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
