'use client'

import { useState } from 'react'
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Modal from '@/app/dashboard/components/Modal'
import type { ExamRow, StudentRow, ScoreRow, SubjectRow } from '@/types'

// ─── Score parsing ─────────────────────────────────────────────────────────

interface ParsedScore { score: number; total: number; pct: number }

function parseScore(raw: string): ParsedScore | null {
  const match = raw.trim().match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/)
  if (!match) return null
  const score = parseFloat(match[1])
  const total = parseFloat(match[2])
  if (isNaN(score) || isNaN(total) || total <= 0) return null
  return { score, total, pct: Math.round((score / total) * 10000) / 100 }
}

function parseColumn(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

function detectTotalItems(scores: ParsedScore[]): number {
  const counts = new Map<number, number>()
  scores.forEach(s => counts.set(s.total, (counts.get(s.total) ?? 0) + 1))
  let maxCount = 0, maxTotal = 1
  counts.forEach((count, total) => { if (count > maxCount) { maxCount = count; maxTotal = total } })
  return maxTotal
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface PreviewRow {
  rawName: string
  rawEmail: string
  parsedBySubject: (ParsedScore | null)[]
  totalParsed: ParsedScore | null
  student: StudentRow | null
  isUnknown: boolean
}

interface Props {
  exam: ExamRow
  classId: string
  classStudents: StudentRow[]
  classPassingPct: number
  subjects: SubjectRow[]
  onClose: () => void
  onImported: (scores: ScoreRow[], detectedTotalItems: number) => void
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)', fontSize: '13px',
  fontFamily: 'monospace', resize: 'none', outline: 'none', lineHeight: '1.6',
}

export default function BulkScoreModal({ exam, classId, classStudents, classPassingPct, subjects, onClose, onImported }: Props) {
  // Derive exam subjects from subject_ids; fall back to single subject_id
  const examSubjects: SubjectRow[] = (() => {
    const ids = exam.subject_ids?.length ? exam.subject_ids : exam.subject_id ? [exam.subject_id] : []
    return ids.map(id => subjects.find(s => s.id === id)).filter(Boolean) as SubjectRow[]
  })()

  const multiSubject = examSubjects.length > 1

  const [namesText, setNamesText] = useState('')
  const [emailsText, setEmailsText] = useState('')
  const [scoreTexts, setScoreTexts] = useState<string[]>(
    examSubjects.length > 1 ? examSubjects.map(() => '') : ['']
  )
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [unknownActions, setUnknownActions] = useState<Record<number, 'skip' | 'add'>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalWarning, setTotalWarning] = useState('')

  const effectivePct = exam.passing_pct_override ?? classPassingPct
  const studentEmailMap = new Map(classStudents.map(s => [s.email?.toLowerCase() ?? '', s]))

  function setScoreText(i: number, val: string) {
    setScoreTexts(prev => { const n = [...prev]; n[i] = val; return n })
  }

  function handlePreview() {
    setError('')
    setTotalWarning('')
    const names = parseColumn(namesText)
    const emails = parseColumn(emailsText)
    const scoreCols = multiSubject
      ? examSubjects.map((_, i) => parseColumn(scoreTexts[i] ?? ''))
      : [parseColumn(scoreTexts[0] ?? '')]

    if (emails.length === 0) { setError('Email column is empty.'); return }
    for (let i = 0; i < scoreCols.length; i++) {
      const label = examSubjects[i]?.name ?? `Subject ${i + 1}`
      if (scoreCols[i].length === 0) { setError(`Score column for "${label}" is empty.`); return }
      if (scoreCols[i].length !== emails.length) {
        setError(`Row count mismatch — Emails: ${emails.length}, ${label} Scores: ${scoreCols[i].length}.`)
        return
      }
    }
    if (names.length > 0 && names.length !== emails.length) {
      setError(`Row count mismatch — Names: ${names.length}, Emails: ${emails.length}.`)
      return
    }

    const parsedCols = scoreCols.map(col => col.map(s => parseScore(s)))
    for (let ci = 0; ci < parsedCols.length; ci++) {
      const bad = parsedCols[ci].map((p, i) => ({ p, i })).filter(x => !x.p)
      if (bad.length > 0) {
        const label = examSubjects[ci]?.name ?? `Subject ${ci + 1}`
        setError(`Could not parse score in "${label}" on row(s): ${bad.map(x => x.i + 1).join(', ')}. Expected: "25 / 50"`)
        return
      }
    }

    if (multiSubject) {
      setTotalWarning(`Scores for ${examSubjects.length} subjects will be summed to compute the total.`)
    } else {
      const totals = new Set(parsedCols[0].map(p => p!.total))
      if (totals.size > 1) {
        setTotalWarning(`Different denominators detected: ${[...totals].join(', ')}. Most common will be used.`)
      }
    }

    const rows: PreviewRow[] = emails.map((email, i) => {
      const student = studentEmailMap.get(email.toLowerCase()) ?? null
      const parsedBySubject = parsedCols.map(col => col[i])
      const allParsed = parsedBySubject.filter(Boolean) as ParsedScore[]
      const totalParsed: ParsedScore | null = allParsed.length > 0
        ? {
            score: allParsed.reduce((s, p) => s + p.score, 0),
            total: allParsed.reduce((s, p) => s + p.total, 0),
            pct: Math.round((allParsed.reduce((s, p) => s + p.score, 0) / allParsed.reduce((s, p) => s + p.total, 0)) * 10000) / 100,
          }
        : null
      return { rawName: names[i] ?? '', rawEmail: email, parsedBySubject, totalParsed, student, isUnknown: !student }
    })

    const defaultActions: Record<number, 'skip' | 'add'> = {}
    rows.forEach((r, i) => { if (r.isUnknown) defaultActions[i] = 'skip' })
    setUnknownActions(defaultActions)
    setPreview(rows)
  }

  async function handleImport() {
    if (!preview) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    const validParsed = preview.filter(r => r.totalParsed).map(r => r.totalParsed!)
    const detectedTotal = detectTotalItems(validParsed)
    const toImport = preview.filter((r, i) => !r.isUnknown || unknownActions[i] === 'add')
    const results: ScoreRow[] = []

    for (const row of toImport) {
      if (!row.totalParsed) continue
      let studentId = row.student?.id

      if (row.isUnknown) {
        const name = row.rawName || row.rawEmail.split('@')[0]
        const { data: newStudent, error: err } = await supabase
          .from('students')
          .upsert({ name, school: null, email: row.rawEmail.toLowerCase() }, { onConflict: 'email' })
          .select('id').single()
        if (err || !newStudent) { setError(`Failed to add student ${row.rawEmail}: ${err?.message}`); setLoading(false); return }
        studentId = newStudent.id
        await supabase.from('class_students')
          .upsert({ class_id: classId, student_id: studentId }, { onConflict: 'class_id,student_id' })
      }

      if (!studentId) continue

      const { data: score, error: err } = await supabase
        .from('scores')
        .upsert(
          { exam_id: exam.id, student_id: studentId, raw_score: row.totalParsed.score, total_items: row.totalParsed.total },
          { onConflict: 'exam_id,student_id' }
        )
        .select('id, exam_id, student_id, raw_score, total_items, percentage, created_at')
        .single()

      if (err || !score) { setError(`Failed to save score: ${err?.message}`); setLoading(false); return }
      results.push(score as ScoreRow)
    }

    await supabase.from('exams').update({ total_items: detectedTotal }).eq('id', exam.id)
    setLoading(false)
    onImported(results, detectedTotal)
  }

  const importCount = preview
    ? preview.filter((r, i) => !r.isUnknown || unknownActions[i] === 'add').length
    : 0

  return (
    <Modal title={`Import Scores — ${exam.name}`} onClose={onClose} width="xl">
      {!preview ? (
        <div className="space-y-5">
          {/* Subject indicator */}
          {examSubjects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Subjects:</span>
              {examSubjects.map(s => (
                <span key={s.id} className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.2)' }}>
                  {s.name}
                </span>
              ))}
              {multiSubject && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  → {examSubjects.length} score columns below
                </span>
              )}
            </div>
          )}

          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Copy each column from Google Sheets and paste below. Scores must be in the format{' '}
            <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              25 / 50
            </code>
            {multiSubject && '. Each subject gets its own column; totals are summed automatically.'}
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${multiSubject ? examSubjects.length + 2 : 3}, minmax(0, 1fr))` }}>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Student Name</label>
              <textarea value={namesText} onChange={e => setNamesText(e.target.value)}
                placeholder={'Juan Dela Cruz\nMaria Santos\n(optional)'} rows={12} style={textareaStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Email<span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea value={emailsText} onChange={e => setEmailsText(e.target.value)}
                placeholder={'juan@email.com\nmaria@email.com\n...'} rows={12} style={textareaStyle} />
            </div>
            {multiSubject ? examSubjects.map((subj, i) => (
              <div key={subj.id}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {subj.name}<span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea value={scoreTexts[i] ?? ''} onChange={e => setScoreText(i, e.target.value)}
                  placeholder={'48 / 50\n25 / 50\n...'} rows={12} style={textareaStyle} />
              </div>
            )) : (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Score<span className="ml-0.5" style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea value={scoreTexts[0] ?? ''} onChange={e => setScoreText(0, e.target.value)}
                  placeholder={'48 / 50\n25 / 50\n30 / 50\n...'} rows={12} style={textareaStyle} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handlePreview}
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white"
              style={{ backgroundColor: '#0BB5C7' }}>
              Preview →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} />
              {preview.length} row{preview.length !== 1 ? 's' : ''} parsed
            </div>
            {multiSubject && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}>
                {examSubjects.length} subjects · totals summed
              </span>
            )}
            {preview.some(r => r.isUnknown) && (
              <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
                {preview.filter(r => r.isUnknown).length} unknown student(s)
              </span>
            )}
            <span className="text-sm ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              Passing: {effectivePct}%{exam.passing_pct_override != null ? ' (custom)' : ' (class default)'}
            </span>
          </div>

          {totalWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: 'var(--color-warning)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />{totalWarning}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['#', 'Name', 'Email',
                    ...(multiSubject ? examSubjects.map(s => s.name) : ['Score']),
                    ...(multiSubject ? ['Total'] : []),
                    '%', 'Result', 'Status',
                  ].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const passes = row.totalParsed ? row.totalParsed.pct >= effectivePct : null
                  return (
                    <tr key={i} style={{
                      borderBottom: i < preview.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: row.isUnknown ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {(row.student?.name ?? row.rawName) || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.rawEmail}</td>
                      {multiSubject
                        ? row.parsedBySubject.map((p, ci) => (
                          <td key={ci} className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {p ? `${p.score}/${p.total}` : <span style={{ color: 'var(--color-danger)' }}>—</span>}
                          </td>
                        ))
                        : (
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.totalParsed ? `${row.totalParsed.score} / ${row.totalParsed.total}` : <span style={{ color: 'var(--color-danger)' }}>Invalid</span>}
                          </td>
                        )}
                      {multiSubject && (
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {row.totalParsed ? `${row.totalParsed.score}/${row.totalParsed.total}` : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {row.totalParsed ? `${row.totalParsed.pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {passes !== null && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={passes
                              ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }
                              : { backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                            {passes ? 'Pass' : 'Fail'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.isUnknown ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                              Unknown
                            </span>
                            <select
                              value={unknownActions[i]}
                              onChange={e => setUnknownActions(prev => ({ ...prev, [i]: e.target.value as 'skip' | 'add' }))}
                              className="text-xs outline-none"
                              style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                              <option value="skip">Skip</option>
                              <option value="add">Add student</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
                            Matched
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
            <button onClick={() => setPreview(null)} className="px-4 py-2 text-sm rounded-xl"
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
                Import {importCount} Score{importCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
