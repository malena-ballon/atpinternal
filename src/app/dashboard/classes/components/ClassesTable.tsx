'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Link2, ExternalLink, Check } from 'lucide-react'
import Link from 'next/link'
import type { ClassSummary, ClassRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import ClassFormModal from './ClassFormModal'

export default function ClassesTable({ initialClasses }: { initialClasses: ClassSummary[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassRow | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/schedule/${id}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {initialClasses.length} {initialClasses.length === 1 ? 'class' : 'classes'}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
          style={{ backgroundColor: '#0BB5C7' }}
        >
          <Plus size={15} />
          New Class
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {initialClasses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No classes yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-medium"
              style={{ color: '#0BB5C7' }}
            >
              Create your first class →
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {['Class Name', 'Status', 'Subjects', 'Sessions', 'Completion', 'Rate', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialClasses.map((cls, i) => (
                <tr
                  key={cls.id}
                  style={{ borderBottom: i < initialClasses.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/classes/${cls.id}`}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: '#0BB5C7' }}
                    >
                      {cls.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={cls.status} />
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {cls.subjectsCount}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {cls.sessionsCount}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-20 h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${cls.completionPct}%`,
                            backgroundColor: cls.completionPct === 100 ? '#16A34A' : '#3DD4E6',
                          }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {cls.completionPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {cls.rate != null ? `₱${cls.rate.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditTarget({
                          id: cls.id, name: cls.name, status: cls.status,
                          rate: cls.rate, zoom_link: cls.zoom_link,
                          description: null, default_passing_pct: 75,
                          at_risk_threshold: null, score_brackets: null,
                          created_at: '', updated_at: '',
                        })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        title="Edit"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => copyLink(cls.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        title="Copy schedule link"
                        style={{ color: copied === cls.id ? '#16A34A' : 'var(--color-text-muted)' }}
                      >
                        {copied === cls.id ? <Check size={14} /> : <Link2 size={14} />}
                      </button>
                      <Link
                        href={`/schedule/${cls.id}`}
                        target="_blank"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        title="Preview public schedule"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <ClassFormModal onClose={() => setShowCreate(false)} />}
      {editTarget && <ClassFormModal class={editTarget} onClose={() => setEditTarget(null)} />}
    </>
  )
}
