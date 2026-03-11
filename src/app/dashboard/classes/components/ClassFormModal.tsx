'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { logActivity } from '@/app/actions'
import Modal from '@/app/dashboard/components/Modal'
import ThresholdInput from '@/app/dashboard/components/ThresholdInput'
import type { ClassRow, ClassStatus, ClassSummary, ScoreBracket } from '@/types'
import { DEFAULT_BRACKETS } from '@/types'

interface Props {
  class?: ClassRow
  onClose: () => void
  onSaved?: (cls: ClassSummary) => void
}

const STATUSES: { value: ClassStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  outline: 'none',
}

const smallInputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
}

export default function ClassFormModal({ class: cls, onClose, onSaved }: Props) {
  const isEdit = !!cls
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: cls?.name ?? '',
    description: cls?.description ?? '',
    zoom_link: cls?.zoom_link ?? '',
    rate: cls?.rate?.toString() ?? '',
    default_passing_pct: cls?.default_passing_pct?.toString() ?? '75',
    at_risk_threshold: cls?.at_risk_threshold?.toString() ?? '',
    status: (cls?.status ?? 'active') as ClassStatus,
  })
  const [brackets, setBrackets] = useState<ScoreBracket[]>(
    cls?.score_brackets ?? DEFAULT_BRACKETS
  )

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  function setBracket(i: number, field: keyof ScoreBracket, val: string) {
    setBrackets(bs => bs.map((b, idx) =>
      idx === i ? { ...b, [field]: field === 'bracket' ? val : parseFloat(val) || 0 } : b
    ))
  }

  function addBracket() {
    setBrackets(bs => [...bs, { bracket: 'New Range', min: 0, max: 0 }])
  }

  function removeBracket(i: number) {
    setBrackets(bs => bs.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Class name is required.'); return }
    setError('')
    setLoading(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      zoom_link: form.zoom_link.trim() || null,
      default_passing_pct: parseFloat(form.default_passing_pct) || 75,
      at_risk_threshold: form.at_risk_threshold.trim() !== '' ? parseFloat(form.at_risk_threshold) : null,
      score_brackets: JSON.stringify(brackets),
      status: form.status,
    }
    if (isEdit) {
      const { error: err } = await supabase.from('classes').update(payload).eq('id', cls!.id)
      setLoading(false)
      if (err) { setError(err.message); return }
      await logActivity('updated_class', 'class', cls!.id, payload.name, `Updated class "${payload.name}" — status: ${payload.status}, passing: ${payload.default_passing_pct}%${payload.at_risk_threshold != null ? `, at-risk: ${payload.at_risk_threshold}%` : ''}${payload.zoom_link ? ', zoom link set' : ''}`)
      onSaved?.({
        id: cls!.id,
        name: payload.name,
        status: payload.status,
        zoom_link: payload.zoom_link ?? null,
        subjectsCount: 0, // will be preserved by caller
        sessionsCount: 0,
        studentsCount: 0,
        completionPct: 0,
        _isEdit: true,
      } as ClassSummary & { _isEdit: boolean })
    } else {
      const { data: inserted, error: err } = await supabase
        .from('classes').insert(payload).select('id').single()
      setLoading(false)
      if (err) { setError(err.message); return }
      await logActivity('added_class', 'class', inserted.id, payload.name, `Added new class "${payload.name}" — status: ${payload.status}, passing: ${payload.default_passing_pct}%${payload.zoom_link ? ', zoom link set' : ''}`)
      onSaved?.({
        id: inserted.id,
        name: payload.name,
        status: payload.status,
        zoom_link: payload.zoom_link ?? null,
        subjectsCount: 0,
        sessionsCount: 0,
        studentsCount: 0,
        completionPct: 0,
      })
    }
    onClose()
  }

  return (
    <Modal title={isEdit ? 'Edit Class' : 'New Class'} onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Class Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. 90-Hr PSHS NCE Review" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={form.description}
              onChange={set('description')}
              placeholder="Brief description of the program"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Default Zoom Link</label>
            <input style={inputStyle} type="url" value={form.zoom_link} onChange={set('zoom_link')} placeholder="https://zoom.us/j/..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Rate / Fee (₱)</label>
            <input style={inputStyle} type="number" step="0.01" min="0" value={form.rate} onChange={set('rate')} placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
            <select style={inputStyle} value={form.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Threshold section */}
        <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Thresholds</p>

          <ThresholdInput
            label="Default Passing %"
            value={form.default_passing_pct}
            onChange={v => setForm(f => ({ ...f, default_passing_pct: v }))}
            hint="Used for pass/fail across all exams unless overridden per exam."
          />

          <ThresholdInput
            label="At-Risk Threshold"
            value={form.at_risk_threshold}
            onChange={v => setForm(f => ({ ...f, at_risk_threshold: v }))}
            hint="Students below this average are flagged at-risk. Leave blank to use the passing % above."
            placeholder="e.g. 60"
          />
        </div>

        {/* Score brackets */}
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Score Distribution Brackets</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBrackets(DEFAULT_BRACKETS)}
                className="text-xs px-2 py-0.5 rounded"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={addBracket}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_90px_90px_28px] gap-2 text-xs font-medium px-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>Label</span><span>Min %</span><span>Max %</span><span />
            </div>
            {brackets.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_90px_28px] gap-2 items-center">
                <input
                  style={smallInputStyle}
                  value={b.bracket}
                  onChange={e => setBracket(i, 'bracket', e.target.value)}
                  placeholder="Label"
                />
                <input
                  style={smallInputStyle}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={b.min}
                  onChange={e => setBracket(i, 'min', e.target.value)}
                />
                <input
                  style={smallInputStyle}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={b.max}
                  onChange={e => setBracket(i, 'max', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeBracket(i)}
                  className="flex items-center justify-center w-7 h-7 rounded"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold rounded-lg text-white flex items-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Class'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
