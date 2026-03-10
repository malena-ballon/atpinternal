'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Link2, ExternalLink, Check, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import type { ClassSummary, ClassRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import ClassFormModal from './ClassFormModal'

export default function ClassesTable({ initialClasses }: { initialClasses: ClassSummary[] }) {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassSummary[]>(initialClasses)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassRow | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)

  function toggleSelectId(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === classes.length ? new Set() : new Set(classes.map(c => c.id)))
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} class${selectedIds.size !== 1 ? 'es' : ''}? This will remove all associated sessions and data. This cannot be undone.`)) return
    setDeletingSelected(true)
    const supabase = createClient()
    await supabase.from('classes').delete().in('id', Array.from(selectedIds))
    setClasses(prev => prev.filter(c => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
    setDeletingSelected(false)
    router.refresh()
  }

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
          {classes.length} {classes.length === 1 ? 'class' : 'classes'}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl disabled:opacity-60"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}
            >
              {deletingSelected ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete {selectedIds.size} selected
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            <Plus size={15} />
            New Class
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {classes.length === 0 ? (
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
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={classes.length > 0 && selectedIds.size === classes.length}
                    onChange={toggleSelectAll}
                    style={{ accentColor: '#0BB5C7' }}
                  />
                </th>
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
              {classes.map((cls, i) => (
                <tr
                  key={cls.id}
                  style={{ borderBottom: i < classes.length - 1 ? '1px solid var(--color-border)' : 'none', backgroundColor: selectedIds.has(cls.id) ? 'rgba(61,212,230,0.04)' : 'transparent' }}
                >
                  <td className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(cls.id)}
                      onChange={() => toggleSelectId(cls.id)}
                      style={{ accentColor: '#0BB5C7' }}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/classes/${cls.id}`}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: '#0A1045' }}
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
