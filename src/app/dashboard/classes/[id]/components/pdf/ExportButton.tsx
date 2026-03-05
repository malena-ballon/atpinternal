'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  onExport: () => Promise<void>
  label?: string
}

export default function ExportButton({ onExport, label = 'Export PDF' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    try { await onExport() }
    catch (e) { console.error('PDF export failed:', e) }
    finally { setLoading(false) }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-60 transition-opacity"
      style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg)' }}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <Download size={12} />
      }
      {loading ? 'Generating…' : label}
    </button>
  )
}

// ── Shared PDF utilities (imported by tab files) ──────────────────────────────
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function pdfFileName(className: string, reportType: string): string {
  const date = new Date().toISOString().split('T')[0]
  const safe = className.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  return `${safe}_${reportType}_${date}.pdf`
}
