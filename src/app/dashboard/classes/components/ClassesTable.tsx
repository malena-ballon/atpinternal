'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Link2, ExternalLink, Check, Trash2, Loader2, MoreHorizontal, Pencil, Pin, PinOff } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { logActivity } from '@/app/actions'
import type { ClassSummary, ClassRow } from '@/types'
import StatusBadge from '@/app/dashboard/components/StatusBadge'
import ClassFormModal from './ClassFormModal'

const PINNED_KEY = 'pinned-classes'

function loadPinned(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]')) }
  catch { return new Set() }
}

function savePinned(ids: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(ids)))
}

// ── Row action dropdown ───────────────────────────────────────────────────────
interface DropdownProps {
  cls: ClassSummary
  pinned: boolean
  copied: boolean
  onEdit: () => void
  onCopyLink: () => void
  onPin: () => void
  onDelete: () => void
}

function ActionDropdown({ cls, pinned, copied, onEdit, onCopyLink, onPin, onDelete }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function out(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 192 })
    setOpen(v => !v)
  }

  const item = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-lg transition-colors'

  const menu = open ? (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: menuPos.top,
        left: menuPos.left,
        zIndex: 9999,
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        borderRadius: 12,
        padding: '6px 0',
        width: 192,
      }}
    >
      <button className={item} style={{ color: 'var(--color-text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        onClick={() => { setOpen(false); onEdit() }}>
        <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} /> Edit
      </button>

      <button className={item} style={{ color: copied ? '#16A34A' : 'var(--color-text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        onClick={() => { setOpen(false); onCopyLink() }}>
        {copied
          ? <Check size={14} style={{ color: '#16A34A' }} />
          : <Link2 size={14} style={{ color: 'var(--color-text-muted)' }} />}
        {copied ? 'Link copied!' : 'Copy schedule link'}
      </button>

      <Link
        href={`/schedule/${cls.id}`}
        target="_blank"
        className={item}
        style={{ color: 'var(--color-text-primary)' }}
        onClick={() => setOpen(false)}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        <ExternalLink size={14} style={{ color: 'var(--color-text-muted)' }} /> Preview schedule
      </Link>

      <button className={item}
        style={{ color: pinned ? '#D97706' : 'var(--color-text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        onClick={() => { setOpen(false); onPin() }}>
        {pinned
          ? <PinOff size={14} style={{ color: '#D97706' }} />
          : <Pin size={14} style={{ color: 'var(--color-text-muted)' }} />}
        {pinned ? 'Unpin class' : 'Pin class'}
      </button>

      <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 8px' }} />

      <button className={item} style={{ color: 'var(--color-danger)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        onClick={() => { setOpen(false); onDelete() }}>
        <Trash2 size={14} style={{ color: 'var(--color-danger)' }} /> Delete
      </button>
    </div>
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <MoreHorizontal size={16} />
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClassesTable({ initialClasses }: { initialClasses: ClassSummary[] }) {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassSummary[]>(initialClasses)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassRow | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [pinned, setPinned] = useState<Set<string>>(new Set())

  useEffect(() => { setPinned(loadPinned()) }, [])

  function togglePin(id: string) {
    setPinned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      savePinned(next)
      return next
    })
  }

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
    const names = classes.filter(c => selectedIds.has(c.id)).map(c => c.name).join(', ')
    await supabase.from('classes').delete().in('id', Array.from(selectedIds))
    await logActivity('deleted_classes', 'class', null, null, `Deleted ${selectedIds.size} class${selectedIds.size !== 1 ? 'es' : ''}: ${names}`)
    setClasses(prev => prev.filter(c => !selectedIds.has(c.id)))
    setPinned(prev => {
      const next = new Set(prev)
      selectedIds.forEach(id => next.delete(id))
      savePinned(next)
      return next
    })
    setSelectedIds(new Set())
    setDeletingSelected(false)
    router.refresh()
  }

  async function handleDeleteOne(id: string) {
    if (!window.confirm('Delete this class? This will remove all associated sessions and data. This cannot be undone.')) return
    const supabase = createClient()
    const name = classes.find(c => c.id === id)?.name ?? id
    await supabase.from('classes').delete().eq('id', id)
    await logActivity('deleted_class', 'class', id, name, `Deleted class: ${name}`)
    setClasses(prev => prev.filter(c => c.id !== id))
    setPinned(prev => { const next = new Set(prev); next.delete(id); savePinned(next); return next })
    router.refresh()
  }

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/schedule/${id}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Pinned classes always first
  const sorted = [
    ...classes.filter(c => pinned.has(c.id)),
    ...classes.filter(c => !pinned.has(c.id)),
  ]

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
                {['Class Name', 'Status', 'Subjects', 'Sessions', 'Students', 'Completion', 'Actions'].map(h => (
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
              {sorted.map((cls, i) => {
                const isPinned = pinned.has(cls.id)
                return (
                  <tr
                    key={cls.id}
                    style={{
                      borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: selectedIds.has(cls.id) ? 'rgba(61,212,230,0.04)' : 'transparent',
                    }}
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
                      <div className="flex items-center gap-2">
                        {isPinned && <Pin size={12} style={{ color: '#D97706', flexShrink: 0 }} />}
                        <Link
                          href={`/dashboard/classes/${cls.id}`}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {cls.name}
                        </Link>
                      </div>
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

                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {cls.studentsCount}
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

                    <td className="px-5 py-4">
                      <ActionDropdown
                        cls={cls}
                        pinned={isPinned}
                        copied={copied === cls.id}
                        onEdit={() => setEditTarget({
                          id: cls.id, name: cls.name, status: cls.status,
                          rate: null, zoom_link: cls.zoom_link,
                          description: null, default_passing_pct: 75,
                          at_risk_threshold: null, score_brackets: null,
                          created_at: '', updated_at: '',
                        })}
                        onCopyLink={() => copyLink(cls.id)}
                        onPin={() => togglePin(cls.id)}
                        onDelete={() => handleDeleteOne(cls.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <ClassFormModal
          onClose={() => setShowCreate(false)}
          onSaved={cls => setClasses(prev => [cls, ...prev])}
        />
      )}
      {editTarget && (
        <ClassFormModal
          class={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={updated => setClasses(prev => prev.map(c =>
            c.id === updated.id
              ? { ...c, name: updated.name, status: updated.status, zoom_link: updated.zoom_link }
              : c
          ))}
        />
      )}
    </>
  )
}
