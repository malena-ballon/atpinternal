'use client'

import { useState, useMemo } from 'react'
import { format, isToday, isThisWeek } from 'date-fns'
import { Mail, Search, Settings, ChevronRight, Users, CheckCircle2, XCircle, AlertCircle, Loader2, Check, CornerDownLeft, FileText, X, Download, Trash2 } from 'lucide-react'
import { saveEmailSettings, getEmailAttachmentUrl, deleteEmails } from '@/app/actions'
import type { SentEmail } from '../page'

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; bg: string; color: string }> = {
  report:         { label: 'Report',         bg: 'rgba(124,58,237,0.12)',  color: '#7C3AED' },
  schedule:       { label: 'Schedule',       bg: 'rgba(11,181,199,0.12)',  color: '#0BB5C7' },
  session_notify: { label: 'Session Notify', bg: 'rgba(217,119,6,0.12)',   color: '#D97706' },
  invite:         { label: 'Invite',         bg: 'rgba(22,163,74,0.12)',   color: '#16A34A' },
  reminder:       { label: 'Reminder',       bg: 'rgba(225,29,72,0.12)',   color: '#E11D48' },
  general:        { label: 'General',        bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },
}

function typeMeta(t: string) {
  return TYPE_META[t] ?? TYPE_META.general
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const m = typeMeta(type)
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

function StatusDots({ sent, failed }: { sent: number; failed: number }) {
  if (failed === 0) return (
    <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
      <CheckCircle2 size={12} /> {sent} sent
    </span>
  )
  if (sent === 0) return (
    <span className="flex items-center gap-1 text-xs" style={{ color: '#DC2626' }}>
      <XCircle size={12} /> {failed} failed
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: '#D97706' }}>
      <AlertCircle size={12} /> {sent} sent · {failed} failed
    </span>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({ initialReplyTo }: { initialReplyTo: string }) {
  const [replyTo, setReplyTo] = useState(initialReplyTo)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    const result = await saveEmailSettings(replyTo.trim())
    setSaving(false)
    if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else setError(result.error ?? 'Save failed')
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Reply Forwarding</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        When a student or recipient replies to any email sent from this system, their reply will be
        directed to the address below. Leave blank to disable reply forwarding.
      </p>

      <div className="space-y-1.5 mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Forward replies to
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={replyTo}
            onChange={e => setReplyTo(e.target.value)}
            placeholder="e.g. admin@acadgenius.org"
            className="flex-1"
            style={{
              padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              fontSize: '14px', outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7', whiteSpace: 'nowrap' }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Saved!</> : 'Save'}
          </button>
        </div>
        {error && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start gap-3">
          <CornerDownLeft size={16} style={{ color: '#0BB5C7', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>How reply forwarding works</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              All emails sent from <strong>noreply@acadgenius.org</strong> include a <em>reply-to</em> header pointing
              to the address above. When a recipient clicks &quot;Reply&quot; in their email client, their message
              goes directly to this address — you&apos;ll see the full thread in that inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PDF viewer modal ──────────────────────────────────────────────────────────

function PdfViewerModal({ filename, url, onClose }: { filename: string; url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ backgroundColor: '#0A1045' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText size={16} style={{ color: '#7C3AED', flexShrink: 0 }} />
          <span className="text-sm font-medium truncate" style={{ color: '#fff' }}>{filename}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={url}
            download={filename}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
          >
            <Download size={12} /> Download
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          src={url}
          title={filename}
          className="w-full h-full"
          style={{ border: 'none', display: 'block' }}
        />
      </div>
    </div>
  )
}

// ── Attachment row ────────────────────────────────────────────────────────────

function AttachmentRow({ attachment }: { attachment: { filename: string; storage_path?: string; recipient_email?: string } }) {
  const [loading, setLoading] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const hasFile = !!attachment.storage_path

  async function handleClick() {
    if (!attachment.storage_path) return
    setLoading(true)
    const result = await getEmailAttachmentUrl(attachment.storage_path)
    setLoading(false)
    if ('url' in result) setViewerUrl(result.url)
    else console.error('[AttachmentRow] signed URL error:', result.error)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading || !hasFile}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: `1px solid ${hasFile ? 'rgba(124,58,237,0.3)' : 'var(--color-border)'}`,
          cursor: hasFile ? 'pointer' : 'default',
        }}
        title={hasFile ? 'Click to view PDF' : 'File not stored — re-send to enable viewing'}
      >
        {loading
          ? <Loader2 size={14} style={{ color: '#7C3AED', flexShrink: 0 }} className="animate-spin" />
          : <FileText size={14} style={{ color: hasFile ? '#7C3AED' : 'var(--color-text-muted)', flexShrink: 0 }} />
        }
        <span className="text-xs flex-1 truncate font-medium" style={{ color: hasFile ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          {attachment.filename}
        </span>
        <span className="text-xs font-semibold shrink-0" style={{ color: hasFile ? '#7C3AED' : 'var(--color-text-muted)' }}>
          {loading ? 'Loading…' : hasFile ? 'View PDF' : 'Not stored'}
        </span>
      </button>
      {viewerUrl && (
        <PdfViewerModal
          filename={attachment.filename}
          url={viewerUrl}
          onClose={() => setViewerUrl(null)}
        />
      )}
    </>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ color: 'var(--color-text-secondary)' }}>{children}</span>
    </div>
  )
}

function DetailPanel({ email }: { email: SentEmail }) {
  const sentAt = new Date(email.sent_at)

  // Attachments that are shared (no specific recipient) go above the list
  // Attachments tied to a recipient are shown inline in their card
  const sharedAttachments = email.attachments.filter(a => !a.recipient_email)
  const perRecipientAttachments = email.attachments.filter(a => a.recipient_email)

  // Map recipient email → their attachments
  const recipientAttachMap = new Map<string, typeof perRecipientAttachments>()
  for (const a of perRecipientAttachments) {
    if (!a.recipient_email) continue
    if (!recipientAttachMap.has(a.recipient_email)) recipientAttachMap.set(a.recipient_email, [])
    recipientAttachMap.get(a.recipient_email)!.push(a)
  }

  const noSubject = !email.subject

  return (
    <div className="p-6 h-full overflow-y-auto space-y-5">
      {/* Subject + type */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug" style={{ color: noSubject ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontStyle: noSubject ? 'italic' : 'normal' }}>
          {email.subject || '<No Subject>'}
        </h2>
        <TypeBadge type={email.type} />
      </div>

      {/* Meta rows */}
      <div className="space-y-2.5">
        <MetaRow label="Sent">{format(sentAt, 'MMM d, yyyy · h:mm a')}</MetaRow>
        {email.sent_by && <MetaRow label="Sent by">{email.sent_by}</MetaRow>}
        {email.context && <MetaRow label="Context">{email.context}</MetaRow>}
        <MetaRow label="Status">
          <StatusDots sent={email.sent_count} failed={email.failed_count} />
        </MetaRow>
      </div>

      {/* Body */}
      {email.body && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Message
          </p>
          <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {email.body}
          </div>
        </div>
      )}

      {/* Shared attachments (class-wide) */}
      {sharedAttachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Attachments ({sharedAttachments.length})
          </p>
          <div className="space-y-1.5">
            {sharedAttachments.map((a, i) => <AttachmentRow key={i} attachment={a} />)}
          </div>
        </div>
      )}

      {/* Recipients */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Recipients ({email.to_addresses.length})
        </p>
        <div className="space-y-1.5">
          {email.to_addresses.map((r, i) => {
            const myAttachments = recipientAttachMap.get(r.email) ?? []
            return (
              <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 px-3 py-2" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: '#0BB5C7' }}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{r.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{r.email}</p>
                  </div>
                </div>
                {myAttachments.length > 0 && (
                  <div className="px-3 pb-2 space-y-1" style={{ backgroundColor: 'var(--color-bg)' }}>
                    {myAttachments.map((a, j) => <AttachmentRow key={j} attachment={a} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_TYPES = ['report', 'schedule', 'session_notify', 'invite', 'reminder', 'general']

interface Props {
  initialEmails: SentEmail[]
  initialReplyTo: string
}

export default function EmailInboxClient({ initialEmails, initialReplyTo }: Props) {
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [emails, setEmails] = useState<SentEmail[]>(initialEmails)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    let list = emails
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.context?.toLowerCase().includes(q) ||
        e.to_addresses.some(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
      )
    }
    return list
  }, [emails, typeFilter, search])

  const selected = selectedId ? emails.find(e => e.id === selectedId) : null

  // Stats
  const todayCount = emails.filter(e => isToday(new Date(e.sent_at))).reduce((s, e) => s + e.sent_count, 0)
  const weekCount = emails.filter(e => isThisWeek(new Date(e.sent_at))).reduce((s, e) => s + e.sent_count, 0)
  const totalCount = emails.reduce((s, e) => s + e.sent_count, 0)

  function toggleCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filtered.map(e => e.id)))
    }
  }

  async function handleDeleteChecked() {
    if (!checkedIds.size) return
    setDeleting(true)
    const ids = Array.from(checkedIds)
    const result = await deleteEmails(ids)
    setDeleting(false)
    if (result.ok) {
      setEmails(prev => prev.filter(e => !checkedIds.has(e.id)))
      if (selectedId && checkedIds.has(selectedId)) setSelectedId(null)
      setCheckedIds(new Set())
    }
  }

  const tabBtn = (t: 'inbox' | 'settings', label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(t)}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors"
      style={{
        backgroundColor: tab === t ? 'rgba(11,181,199,0.1)' : 'transparent',
        color: tab === t ? '#0BB5C7' : 'var(--color-text-secondary)',
        border: tab === t ? '1px solid rgba(11,181,199,0.25)' : '1px solid transparent',
      }}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Email</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Outgoing emails sent from noreply@acadgenius.org
          </p>
        </div>
        <div className="flex gap-2">
          {tabBtn('inbox', 'Sent', <Mail size={14} />)}
          {tabBtn('settings', 'Settings', <Settings size={14} />)}
        </div>
      </div>

      {/* Stats */}
      {tab === 'inbox' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sent today',     value: todayCount },
            { label: 'Sent this week', value: weekCount },
            { label: 'Total sent',     value: totalCount },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' ? (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <SettingsPanel initialReplyTo={initialReplyTo} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden flex" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', minHeight: '500px' }}>

          {/* Left: Email list */}
          <div className="flex flex-col" style={{ width: '360px', flexShrink: 0, borderRight: '1px solid var(--color-border)' }}>
            {/* Search + filter */}
            <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search emails…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px 6px 28px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
                  }}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['all', ...ALL_TYPES].map(t => {
                  const isAll = t === 'all'
                  const active = typeFilter === t
                  const m = isAll ? null : typeMeta(t)
                  return (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                      style={{
                        backgroundColor: active ? (m?.bg ?? 'rgba(11,181,199,0.12)') : 'var(--color-bg)',
                        color: active ? (m?.color ?? '#0BB5C7') : 'var(--color-text-muted)',
                        border: `1px solid ${active ? (m?.color ?? '#0BB5C7') + '40' : 'var(--color-border)'}`,
                      }}>
                      {isAll ? 'All' : m!.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selection toolbar */}
            {checkedIds.size > 0 && (
              <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checkedIds.size === filtered.length}
                    onChange={toggleCheckAll}
                    className="rounded"
                    style={{ accentColor: '#EF4444', cursor: 'pointer' }}
                  />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {checkedIds.size} of {filtered.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCheckedIds(new Set())}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteChecked}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
                    style={{ backgroundColor: '#EF4444' }}
                  >
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    {deleting ? 'Deleting…' : `Delete ${checkedIds.size}`}
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Mail size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
                  <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>No emails found</p>
                </div>
              ) : (
                filtered.map((email, i) => {
                  const isSelected = selectedId === email.id
                  const isChecked = checkedIds.has(email.id)
                  const sentAt = new Date(email.sent_at)
                  const dateStr = isToday(sentAt) ? format(sentAt, 'h:mm a') : format(sentAt, 'MMM d')
                  const noSubject = !email.subject
                  return (
                    <div
                      key={email.id}
                      className="relative flex items-stretch group"
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                        backgroundColor: isChecked ? 'rgba(239,68,68,0.04)' : isSelected ? 'rgba(11,181,199,0.06)' : 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center pl-3 pr-1 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={e => toggleCheck(email.id, e)}
                          onChange={() => {}}
                          style={{ accentColor: '#EF4444', cursor: 'pointer' }}
                        />
                      </div>
                      {/* Row */}
                      <button
                        onClick={() => setSelectedId(isSelected ? null : email.id)}
                        className="flex-1 text-left px-3 py-3 min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium leading-snug truncate"
                            style={{ color: noSubject ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontStyle: noSubject ? 'italic' : 'normal' }}>
                            {email.subject || '<No Subject>'}
                          </p>
                          <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{dateStr}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <TypeBadge type={email.type} />
                            {email.context && (
                              <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                {email.context}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {email.attachments.length > 0 && <FileText size={11} style={{ color: '#7C3AED' }} />}
                            <Users size={11} style={{ color: 'var(--color-text-muted)' }} />
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{email.to_addresses.length}</span>
                            <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', opacity: isSelected ? 1 : 0.4 }} />
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Detail or empty state */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <DetailPanel email={selected} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(11,181,199,0.08)' }}>
                  <Mail size={24} style={{ color: '#0BB5C7' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Select an email</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Click any email in the list to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
