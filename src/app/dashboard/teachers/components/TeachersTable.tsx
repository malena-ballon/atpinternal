'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, X, Check, UserX, Users, UserCheck, Clock, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { TeacherRow } from '@/types'
import type { TeacherWithStats, PendingUser } from '../page'
import TeacherFormModal from './TeacherFormModal'
import { approveUser, rejectUser, sendTeacherInvite } from '@/app/actions'

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}
const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type Tab = 'teachers' | 'pending' | 'invited'

interface Props {
  activeTeachers: TeacherWithStats[]
  pendingUsers: PendingUser[]
  invitedTeachers: TeacherWithStats[]
  currentUserRole: 'admin' | 'teacher'
  currentTeacherId: string | null
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const text = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ backgroundColor: 'rgba(11,181,199,0.12)', color: '#0BB5C7' }}>
      {text}
    </div>
  )
}

function AvailabilityTags({ teacher }: { teacher: TeacherRow }) {
  if (!teacher.availability?.length) {
    return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
  }
  const sorted = [...teacher.availability].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((e, i) => (
        <span key={`${e.day}-${i}`} className="text-xs px-1.5 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(11,181,199,0.08)', color: '#0BB5C7' }}
          title={`${e.start} – ${e.end}`}>
          {DAY_ABBR[e.day] ?? e.day}
        </span>
      ))}
    </div>
  )
}

export default function TeachersTable({ activeTeachers, pendingUsers, invitedTeachers, currentUserRole, currentTeacherId }: Props) {
  const isAdmin = currentUserRole === 'admin'
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState(activeTeachers)
  const [invited, setInvited] = useState(invitedTeachers)
  const [pending, setPending] = useState(pendingUsers)
  const [q, setQ] = useState('')
  const [editTarget, setEditTarget] = useState<TeacherRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const currentList = tab === 'teachers' ? teachers : invited
  const filtered = currentList.filter(t => {
    if (!q) return true
    const low = q.toLowerCase()
    return t.name.toLowerCase().includes(low)
      || t.email.toLowerCase().includes(low)
      || (t.specialization?.toLowerCase().includes(low) ?? false)
  })

  function onSaved(saved: TeacherRow) {
    if (tab === 'teachers') {
      setTeachers(prev => {
        const idx = prev.findIndex(t => t.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...saved }; return next }
        return [{ ...saved, upcomingSessions: 0, totalSessions: 0 }, ...prev]
      })
    } else {
      setInvited(prev => {
        const idx = prev.findIndex(t => t.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...saved }; return next }
        return [{ ...saved, upcomingSessions: 0, totalSessions: 0 }, ...prev]
      })
    }
    setEditTarget(null)
    setShowCreate(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    await createClient().from('teachers').delete().eq('id', id)
    if (tab === 'teachers') setTeachers(prev => prev.filter(t => t.id !== id))
    else setInvited(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  async function handleApprove(userId: string) {
    setActionLoading(userId)
    setActionError('')
    const res = await approveUser(userId)
    setActionLoading(null)
    if (!res.ok) { setActionError(res.error ?? 'Failed to approve'); return }
    setPending(prev => prev.filter(u => u.id !== userId))
    router.refresh()
  }

  async function handleSendInvite(teacherId: string) {
    setActionLoading('invite-' + teacherId)
    setActionError('')
    setInviteSuccess(null)
    const res = await sendTeacherInvite(teacherId)
    setActionLoading(null)
    if (!res.ok) { setActionError(res.error ?? 'Failed to send invite'); return }
    setInviteSuccess(teacherId)
    setTimeout(() => setInviteSuccess(null), 3000)
  }

  async function handleReject(userId: string) {
    setActionLoading(userId + '-reject')
    setActionError('')
    const res = await rejectUser(userId)
    setActionLoading(null)
    if (!res.ok) { setActionError(res.error ?? 'Failed to reject'); return }
    setPending(prev => prev.filter(u => u.id !== userId))
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    outline: 'none',
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number; adminOnly?: boolean }[] = [
    { id: 'teachers', label: 'Teachers', icon: <UserCheck size={14} />, count: teachers.length },
    { id: 'pending', label: 'Pending', icon: <Clock size={14} />, count: pending.length, adminOnly: true },
    { id: 'invited', label: 'Invited', icon: <Users size={14} />, count: invited.length, adminOnly: true },
  ]

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setQ('') }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t.id
              ? { backgroundColor: '#0BB5C7', color: '#fff' }
              : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            {t.icon}
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={tab === t.id
                ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {actionError && (
        <p className="text-sm px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
          {actionError}
        </p>
      )}
      {inviteSuccess && (
        <p className="text-sm px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.08)', color: '#16a34a' }}>
          Invite email sent successfully.
        </p>
      )}

      {/* ── PENDING TAB ─────────────────────────────────────────────────────── */}
      {tab === 'pending' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {pending.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No pending registrations.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  {['Name', 'Email', 'Registered', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < pending.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Initials name={u.name} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(u.id)}
                          disabled={actionLoading === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#16a34a' }}
                        >
                          <Check size={12} />
                          {actionLoading === u.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(u.id)}
                          disabled={actionLoading === u.id + '-reject'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}
                        >
                          <UserX size={12} />
                          {actionLoading === u.id + '-reject' ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TEACHERS / INVITED TABS ──────────────────────────────────────────── */}
      {tab !== 'pending' && (
        <>
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder={`Search ${tab === 'teachers' ? 'teachers' : 'invited'}…`}
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full text-sm outline-none"
                style={{ ...inputStyle, paddingLeft: '32px' }}
              />
            </div>
            {q && (
              <button onClick={() => setQ('')} className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <X size={13} /> Clear
              </button>
            )}
            {tab === 'invited' && isAdmin && (
              <div className="ml-auto">
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
                  style={{ backgroundColor: '#0BB5C7' }}
                >
                  <Plus size={15} /> Add Teacher
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {filtered.length === 0 ? (
              <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {q
                  ? 'No teachers match your search.'
                  : tab === 'teachers'
                    ? 'No active teachers yet. Approve a pending registration or add one.'
                    : 'No invited teachers. Use "Add Teacher" to create a teacher record.'}
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    {['Teacher', 'Specialization', 'Email', 'Availability', 'Upcoming', 'Total', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Initials name={t.name} />
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {t.specialization ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t.email}</td>
                      <td className="px-4 py-3"><AvailabilityTags teacher={t} /></td>
                      <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {t.upcomingSessions > 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold"
                            style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                            {t.upcomingSessions}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                        {t.totalSessions}
                      </td>
                      <td className="px-4 py-3">
                        {deleteConfirm === t.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Delete?</span>
                            <button onClick={() => handleDelete(t.id)} disabled={deleting}
                              className="text-xs font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                              {deleting ? '…' : 'Yes'}
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="text-xs px-2 py-1 rounded-lg"
                              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {tab === 'invited' && isAdmin && (
                              <button
                                onClick={() => handleSendInvite(t.id)}
                                disabled={actionLoading === 'invite-' + t.id}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-50"
                                style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}
                                title="Send invite email"
                              >
                                {actionLoading === 'invite-' + t.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <Send size={11} />}
                                {inviteSuccess === t.id ? 'Sent!' : 'Invite'}
                              </button>
                            )}
                            {(isAdmin || t.id === currentTeacherId) ? (
                              <>
                                <button onClick={() => setEditTarget(t)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ color: 'var(--color-text-muted)' }} title="Edit">
                                  <Pencil size={13} />
                                </button>
                                {isAdmin && (
                                  <button onClick={() => setDeleteConfirm(t.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ color: 'var(--color-danger)' }} title="Delete">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-lg"
                                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                                title="Contact admin to make changes">
                                No access
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <TeacherFormModal onClose={() => setShowCreate(false)} onSaved={onSaved} />
      )}
      {editTarget && (
        <TeacherFormModal teacher={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
      )}
    </>
  )
}
