'use client'

import { useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import type { StudentRow } from '@/types'

interface Props {
  classId: string
  existingStudents: StudentRow[]
  onClose: () => void
  onImported: (students: StudentRow[]) => void
}

function parseColumn(text: string): string[] {
  if (!text.trim()) return []
  const lines = text.split('\n').map(s => s.trim())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface ParsedRow {
  name: string
  school: string
  email: string
  isDuplicate: boolean
}

export default function BulkPasteModal({ classId, existingStudents, onClose, onImported }: Props) {
  const [namesText, setNamesText] = useState('')
  const [schoolsText, setSchoolsText] = useState('')
  const [emailsText, setEmailsText] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [dupActions, setDupActions] = useState<Record<number, 'skip' | 'overwrite'>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const existingEmails = new Set(
    existingStudents.map(s => s.email?.toLowerCase()).filter(Boolean) as string[]
  )

  function handleParse() {
    setError('')
    const names = parseColumn(namesText)
    const schools = parseColumn(schoolsText)
    const emails = parseColumn(emailsText)

    if (names.length === 0) { setError('Name column is empty.'); return }
    if (emails.length === 0) { setError('Email column is empty.'); return }

    if (names.length !== emails.length) {
      setError(`Row count mismatch — Names: ${names.length}, Emails: ${emails.length}. Each column must have the same number of rows.`)
      return
    }
    if (schools.length > 0 && schools.length !== names.length) {
      setError(`Row count mismatch — Names: ${names.length}, Schools: ${schools.length}. Each column must have the same number of rows.`)
      return
    }

    const invalidIdxs = emails.map((e, i) => i).filter(i => !isValidEmail(emails[i]))
    if (invalidIdxs.length > 0) {
      setError(`Invalid email format on row(s): ${invalidIdxs.map(i => i + 1).join(', ')}`)
      return
    }

    const rows: ParsedRow[] = names.map((name, i) => ({
      name,
      school: schools[i] ?? '',
      email: emails[i],
      isDuplicate: existingEmails.has(emails[i].toLowerCase()),
    }))

    const defaultActions: Record<number, 'skip' | 'overwrite'> = {}
    rows.forEach((r, i) => { if (r.isDuplicate) defaultActions[i] = 'skip' })
    setDupActions(defaultActions)
    setParsed(rows)
  }

  async function handleImport() {
    if (!parsed) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    const toImport = parsed.filter((r, i) => !r.isDuplicate || dupActions[i] === 'overwrite')
    const results: StudentRow[] = []

    for (const row of toImport) {
      const { data: student, error: err } = await supabase
        .from('students')
        .upsert(
          { name: row.name, school: row.school || null, email: row.email.toLowerCase() },
          { onConflict: 'email' }
        )
        .select('id, name, school, email, created_at')
        .single()

      if (err || !student) {
        setError(err?.message ?? 'Failed to save a student record.')
        setLoading(false)
        return
      }

      await supabase
        .from('class_students')
        .upsert({ class_id: classId, student_id: student.id }, { onConflict: 'class_id,student_id' })

      results.push(student as StudentRow)
    }

    setLoading(false)
    onImported(results)
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.6',
  }

  const importCount = parsed
    ? parsed.filter((r, i) => !r.isDuplicate || dupActions[i] === 'overwrite').length
    : 0

  return (
    <Modal title="Bulk Import Students" onClose={onClose} width="xl">
      {!parsed ? (
        <div className="space-y-5">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Copy each column from Google Sheets and paste below. Each line becomes one student row.
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Name', required: true, value: namesText, set: setNamesText, placeholder: 'Juan Dela Cruz\nMaria Santos\n...' },
              { label: 'School', required: false, value: schoolsText, set: setSchoolsText, placeholder: 'UP Diliman\nAdMU\n(optional)' },
              { label: 'Email', required: true, value: emailsText, set: setEmailsText, placeholder: 'juan@email.com\nmaria@email.com\n...' },
            ] as const).map(({ label, required, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {label}{required && <span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>}
                </label>
                <textarea
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  rows={12}
                  style={textareaStyle}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleParse}
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}>
              Preview →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} />
            {parsed.length} row{parsed.length !== 1 ? 's' : ''} parsed — review before importing.
            {parsed.some(r => r.isDuplicate) && (
              <span className="ml-1" style={{ color: 'var(--color-warning)' }}>
                {parsed.filter(r => r.isDuplicate).length} duplicate(s) detected.
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['#', 'Name', 'School', 'Email', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map((row, i) => {
                  const isDup = row.isDuplicate
                  const action = dupActions[i]
                  return (
                    <tr key={i} style={{
                      borderBottom: i < parsed.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: isDup ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.name}</td>
                      <td className="px-3 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{row.school || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.email}</td>
                      <td className="px-3 py-2.5">
                        {isDup ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                              Duplicate
                            </span>
                            <select
                              value={action}
                              onChange={e => setDupActions(prev => ({ ...prev, [i]: e.target.value as 'skip' | 'overwrite' }))}
                              className="text-xs outline-none"
                              style={{
                                padding: '2px 6px', borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg)',
                                color: 'var(--color-text-secondary)',
                              }}>
                              <option value="skip">Skip</option>
                              <option value="overwrite">Overwrite</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setParsed(null)} className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              ← Back
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={loading || importCount === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
                style={{ backgroundColor: '#0BB5C7' }}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                Import {importCount} Student{importCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
