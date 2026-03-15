'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, RefreshCw, Send, Link2, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { generateStudentCodes, getStudentCodes, sendStudentAccessCodes } from '@/app/actions'
import type { StudentRow } from '@/types'

interface Props {
  classId: string
  className: string
  students: StudentRow[]
}

interface CodeEntry {
  studentId: string
  code: string | null
}

export default function StudentCodesTab({ classId, className, students }: Props) {
  const [codes, setCodes] = useState<CodeEntry[]>([])
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [genError, setGenError] = useState('')

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal`
    : '/portal'

  useEffect(() => {
    loadCodes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadCodes() {
    setLoading(true)
    const result = await getStudentCodes(students.map(s => s.id))
    const map = new Map((result.codes ?? []).map(c => [c.studentId, c.code]))
    setCodes(students.map(s => ({ studentId: s.id, code: map.get(s.id) ?? null })))
    setLoading(false)
  }

  async function handleGenerateAll() {
    setGenerating(true)
    setGenError('')
    const result = await generateStudentCodes(students.map(s => s.id))
    if (result.ok && result.codes) {
      const map = new Map(result.codes.map(c => [c.studentId, c.code]))
      setCodes(students.map(s => ({ studentId: s.id, code: map.get(s.id) ?? null })))
    } else {
      setGenError(result.error ?? 'Failed to generate codes. Make sure the database migration has been applied.')
    }
    setGenerating(false)
  }

  async function handleGenerateSelected() {
    if (!selected.size) return
    setGenerating(true)
    setGenError('')
    const result = await generateStudentCodes(Array.from(selected))
    if (result.ok && result.codes) {
      const map = new Map(result.codes.map(c => [c.studentId, c.code]))
      setCodes(prev => prev.map(c => map.has(c.studentId) ? { ...c, code: map.get(c.studentId)! } : c))
    } else {
      setGenError(result.error ?? 'Failed to generate codes.')
    }
    setGenerating(false)
  }

  async function handleSendCodes() {
    if (!selected.size) return
    const recipients = Array.from(selected).flatMap(id => {
      const student = students.find(s => s.id === id)
      const codeEntry = codes.find(c => c.studentId === id)
      if (!student?.email || !codeEntry?.code) return []
      return [{ name: student.name, email: student.email, code: codeEntry.code }]
    })
    if (!recipients.length) {
      alert('None of the selected students have an email address or a generated code.')
      return
    }
    setSending(true)
    setSendResult(null)
    const result = await sendStudentAccessCodes(recipients, className)
    setSendResult(result)
    setSending(false)
  }

  function toggleReveal(id: string) {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === students.length) setSelected(new Set())
    else setSelected(new Set(students.map(s => s.id)))
  }

  async function copyPortalUrl() {
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const codesMap = new Map(codes.map(c => [c.studentId, c.code]))
  const selectedWithCode = Array.from(selected).filter(id => codesMap.get(id))
  const selectedWithEmail = selectedWithCode.filter(id => students.find(s => s.id === id)?.email)
  const allHaveCodes = students.every(s => codesMap.get(s.id))

  return (
    <div className="space-y-5">
      {/* Portal link banner */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ backgroundColor: 'rgba(30,58,95,0.06)', border: '1px solid rgba(30,58,95,0.15)' }}>
        <Link2 size={16} style={{ color: '#1E3A5F', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: '#1E3A5F' }}>Public Student Portal</p>
          <p className="text-xs text-gray-400 truncate">{portalUrl}</p>
        </div>
        <button
          onClick={copyPortalUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ backgroundColor: copied ? 'rgba(22,163,74,0.1)' : 'rgba(30,58,95,0.1)', color: copied ? '#16A34A' : '#1E3A5F' }}
        >
          {copied ? <><CheckCircle2 size={12} /> Copied!</> : <><Link2 size={12} /> Copy Link</>}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {allHaveCodes ? 'Regenerate All Codes' : 'Generate All Codes'}
        </button>

        {selected.size > 0 && (
          <>
            <button
              onClick={handleGenerateSelected}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'rgba(30,58,95,0.08)', color: '#1E3A5F', border: '1px solid rgba(30,58,95,0.2)' }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Regenerate for Selected ({selected.size})
            </button>

            <button
              onClick={handleSendCodes}
              disabled={sending || selectedWithEmail.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send Codes ({selectedWithEmail.length} with email)
            </button>
          </>
        )}

        {genError && (
          <span className="text-xs px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
            ✕ {genError}
          </span>
        )}

        {sendResult && (
          <span className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5"
            style={{ backgroundColor: sendResult.failed === 0 ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: sendResult.failed === 0 ? '#16A34A' : '#DC2626' }}>
            <Mail size={11} />
            {sendResult.sent} sent{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === students.length && students.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-[#1E3A5F] cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Access Code</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => {
                const code = codesMap.get(student.id) ?? null
                const revealed = revealedIds.has(student.id)
                const isSelected = selected.has(student.id)
                return (
                  <tr key={student.id}
                    style={{ borderBottom: i < students.length - 1 ? '1px solid var(--color-border)' : 'none', backgroundColor: isSelected ? 'rgba(30,58,95,0.03)' : undefined }}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(student.id)}
                        className="accent-[#1E3A5F] cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{student.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      {student.email ?? <span className="italic text-gray-300">no email</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {code ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold tracking-widest"
                            style={{ color: '#1E3A5F', letterSpacing: revealed ? '0.2em' : undefined }}>
                            {revealed ? code : '••••••'}
                          </span>
                          <button
                            onClick={() => toggleReveal(student.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title={revealed ? 'Hide code' : 'Reveal code'}
                          >
                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-300">not generated</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Students need their access code to log in at the portal. Codes are unique per student. Use &ldquo;Regenerate&rdquo; to issue a new code if a student loses theirs.
      </p>
    </div>
  )
}
