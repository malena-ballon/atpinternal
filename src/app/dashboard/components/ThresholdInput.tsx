'use client'

import { useState } from 'react'

interface Props {
  value: string          // always stored as % string, e.g. "75"
  onChange: (pct: string) => void
  placeholder?: string
  label?: string
  hint?: string
  totalItems?: number    // if provided, shows X/Y ratio hint
}

export default function ThresholdInput({ value, onChange, placeholder, label, hint, totalItems }: Props) {
  const [mode, setMode] = useState<'pct' | 'xy'>('pct')
  const [num, setNum] = useState('')
  const [den, setDen] = useState(totalItems != null ? String(totalItems) : '')

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    fontSize: '14px',
    outline: 'none',
  }

  function handlePctChange(v: string) {
    onChange(v)
  }

  function handleNumChange(v: string) {
    setNum(v)
    const d = parseFloat(den)
    const n = parseFloat(v)
    if (!isNaN(n) && !isNaN(d) && d > 0) {
      onChange(((n / d) * 100).toFixed(2))
    }
  }

  function handleDenChange(v: string) {
    setDen(v)
    const d = parseFloat(v)
    const n = parseFloat(num)
    if (!isNaN(n) && !isNaN(d) && d > 0) {
      onChange(((n / d) * 100).toFixed(2))
    }
  }

  function switchMode(next: 'pct' | 'xy') {
    if (next === 'xy') {
      // pre-fill numerator from current pct value if possible
      if (value && den) {
        const d = parseFloat(den)
        const pct = parseFloat(value)
        if (!isNaN(d) && !isNaN(pct)) {
          setNum(((pct / 100) * d).toFixed(0))
        }
      }
    } else {
      // coming back to pct: value is already up to date
    }
    setMode(next)
  }

  const computedPct = mode === 'xy' && num && den
    ? (parseFloat(num) / parseFloat(den) * 100)
    : null

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </label>
          {/* Mode toggle */}
          <div
            className="flex rounded-lg overflow-hidden text-xs"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {(['pct', 'xy'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="px-2.5 py-1 font-medium transition-colors"
                style={mode === m
                  ? { backgroundColor: '#0BB5C7', color: '#fff' }
                  : { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }
                }
              >
                {m === 'pct' ? '% mode' : 'X / Y mode'}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'pct' ? (
        <div className="flex items-center gap-2">
          <input
            style={{ ...inputStyle, width: '100%' }}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={value}
            onChange={e => handlePctChange(e.target.value)}
            placeholder={placeholder ?? '75'}
          />
          <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>%</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="number"
            min="0"
            step="1"
            value={num}
            onChange={e => handleNumChange(e.target.value)}
            placeholder="e.g. 35"
          />
          <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>/</span>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="number"
            min="1"
            step="1"
            value={den}
            onChange={e => handleDenChange(e.target.value)}
            placeholder="e.g. 50"
          />
          {computedPct != null && !isNaN(computedPct) && (
            <span
              className="text-xs font-semibold flex-shrink-0 px-2 py-1 rounded"
              style={{ backgroundColor: 'rgba(11,181,199,0.1)', color: '#0BB5C7' }}
            >
              = {computedPct.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
      )}
    </div>
  )
}
