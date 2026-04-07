'use client'

import { useState, useEffect } from 'react'
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './Sidebar'

export default function MainArea({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Sync with initial localStorage value
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)

    function handler(e: Event) {
      setCollapsed((e as CustomEvent<{ collapsed: boolean }>).detail.collapsed)
    }
    window.addEventListener('sidebar-toggle', handler)
    return () => window.removeEventListener('sidebar-toggle', handler)
  }, [])

  const ml = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <div
      className="flex flex-col flex-1 transition-all duration-300"
      style={{ marginLeft: ml, minHeight: '100vh' }}
    >
      {children}
    </div>
  )
}
