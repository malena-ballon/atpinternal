'use client'

import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Clock, FileText, CheckCircle2, PlayCircle, CalendarClock } from 'lucide-react'

function fmt12(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const STATUS_META: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  scheduled:   { label: 'Upcoming',    bg: 'rgba(11,181,199,0.1)',  color: '#0891b2',  icon: <CalendarClock size={11} /> },
  in_progress: { label: 'In Progress', bg: 'rgba(217,119,6,0.1)',   color: '#d97706',  icon: <PlayCircle size={11} /> },
  completed:   { label: 'Done',        bg: 'rgba(22,163,74,0.1)',   color: '#16a34a',  icon: <CheckCircle2 size={11} /> },
}

type StatusKey = keyof typeof STATUS_META

interface Session {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  topic?: string | null
  subject_ids?: string[] | null
  is_assessment?: boolean | null
  subjects?: { name: string } | null
}

interface Props {
  sessions: Session[]
  subjects: { id: string; name: string }[]
}

// Helper to safely decode HTML tags in the topic string
function decodeHtml(html: string) {
  if (typeof document === 'undefined') return html
  const txt = document.createElement('textarea')
  txt.innerHTML = html
  return txt.value
}

export default function PublicSessionsTable({ sessions, subjects }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [shownStatuses, setShownStatuses] = useState<Set<StatusKey>>(new Set(['scheduled', 'in_progress']))

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleStatus(s: StatusKey) {
    setShownStatuses(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  // Which status pills to show (only those present in the data)
  const availableStatuses = Object.keys(STATUS_META).filter(s =>
    sessions.some(sess => sess.status === s)
  ) as StatusKey[]

  const visible = sessions.filter(s => shownStatuses.has(s.status as StatusKey))

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      {/* Status filter pills */}
      {availableStatuses.length > 1 && (
        <div className="flex flex-wrap gap-2 pb-1">
          {availableStatuses.map(s => {
            const m = STATUS_META[s]
            const active = shownStatuses.has(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active ? m.bg : 'white',
                  color: active ? m.color : '#94a3b8',
                  border: `1.5px solid ${active ? m.color : '#e2e8f0'}`,
                  boxShadow: active ? `0 0 0 1px ${m.color}22` : 'none',
                }}
              >
                {m.icon}
                {m.label}
                <span className="ml-0.5 opacity-60 font-normal">
                  ({sessions.filter(sess => sess.status === s).length})
                </span>
              </button>
            )
          })}
        </div>
      )}

      {visible.length === 0 && (
        <div className="rounded-2xl p-8 text-center bg-white shadow-sm border border-gray-100 mt-2">
          <p className="text-sm text-gray-400">No sessions match the selected filters.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="mt-2">
          {/* Desktop table */}
          {/* Kept overflow-x-auto just to protect tiny mobile screens, but 6 columns will fit nicely on desktop */}
          <div className="hidden sm:block w-full overflow-x-auto rounded-2xl bg-white shadow-sm border border-gray-100">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 w-8">#</th>
                  {/* CHANGED: Removed "Day" column header entirely */}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Time</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Subject</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Topic</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => {
                  const names = [
                    ...(s.subject_ids?.length
                      ? s.subject_ids.map(id => subjects.find(sub => sub.id === id)?.name).filter(Boolean) as string[]
                      : s.subjects?.name ? [s.subjects.name] : []),
                    ...(s.is_assessment ? ['Assessment'] : []),
                  ]
                  const isLast = i === visible.length - 1
                  const isExpanded = expandedIds.has(s.id)
                  const meta = STATUS_META[s.status] ?? STATUS_META.scheduled
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-blue-50/30 transition-colors"
                        style={{ borderBottom: isExpanded ? 'none' : (isLast ? 'none' : '1px solid #f1f5f9') }}>
                        <td className="px-3 py-3.5 text-xs font-bold text-gray-300">{i + 1}</td>
                        
                        {/* CHANGED: Combined Date and Day into one clean column to save massive horizontal space */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-800">
                            {format(parseISO(s.date), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {format(parseISO(s.date), 'EEEE')}
                          </div>
                        </td>

                        <td className="px-3 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Clock size={11} className="text-gray-400 shrink-0" />
                            {fmt12(s.start_time)} – {fmt12(s.end_time)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {names.length > 0
                            ? <div className="flex flex-wrap gap-1">{names.map((n, ni) => <span key={ni} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0891b2' }}>{n}</span>)}</div>
                            : <span className="text-sm text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ backgroundColor: meta.bg, color: meta.color }}>
                            {meta.icon}{meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {s.topic
                            ? <button onClick={() => toggle(s.id)} className="flex items-center gap-1 text-xs font-medium whitespace-nowrap" style={{ color: '#0891b2' }}>
                                <FileText size={12} />{isExpanded ? 'Hide' : 'View topic'}
                              </button>
                            : <span className="text-sm text-gray-300">—</span>}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                          {/* CHANGED: Adjusted colSpan from 7 to 6 since we removed a column */}
                          <td colSpan={6} className="px-3 pb-4 pt-0">
                            <div 
                              className="rich-content rounded-lg px-4 py-3 text-sm text-gray-700 bg-slate-50 border border-slate-100" 
                              dangerouslySetInnerHTML={{ __html: decodeHtml(s.topic ?? '') }} 
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {visible.map((s, i) => {
              const names = [
                ...(s.subject_ids?.length
                  ? s.subject_ids.map(id => subjects.find(sub => sub.id === id)?.name).filter(Boolean) as string[]
                  : s.subjects?.name ? [s.subjects.name] : []),
                ...(s.is_assessment ? ['Assessment'] : []),
              ]
              const isExpanded = expandedIds.has(s.id)
              const meta = STATUS_META[s.status] ?? STATUS_META.scheduled
              return (
                <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{format(parseISO(s.date), 'MMMM d, yyyy')}</p>
                        <p className="text-xs text-gray-400">{format(parseISO(s.date), 'EEEE')}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={{ backgroundColor: meta.bg, color: meta.color }}>
                      {meta.icon}{meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <Clock size={11} className="text-gray-400" />
                    {fmt12(s.start_time)} – {fmt12(s.end_time)}
                  </div>
                  {names.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {names.map((n, ni) => (
                        <span key={ni} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0891b2' }}>{n}</span>
                      ))}
                    </div>
                  )}
                  {s.topic && (
                    <div className="mt-2">
                      <button onClick={() => toggle(s.id)} className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: '#0891b2' }}>
                        <FileText size={11} />{isExpanded ? 'Hide topic' : 'View topic'}
                      </button>
                      {isExpanded && (
                        <div 
                          className="rich-content text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2" 
                          dangerouslySetInnerHTML={{ __html: decodeHtml(s.topic ?? '') }} 
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}