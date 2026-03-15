'use client'

import { useState, useEffect, useRef } from 'react'

function fmt12(t: string): string {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function parse12(raw: string): string {
  if (!raw?.trim()) return ''
  raw = raw.trim()
  // Already HH:MM
  if (/^\d{2}:\d{2}$/.test(raw)) return raw
  // H:MM or HH:MM without AM/PM → assume as-is
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  // H:MM AM/PM
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = ampm[2]
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    return `${h.toString().padStart(2, '0')}:${m}`
  }
  // Just a number like "3" → treat as hour
  const justNum = raw.match(/^(\d{1,2})\s*(AM|PM)$/i)
  if (justNum) {
    let h = parseInt(justNum[1])
    if (justNum[2].toUpperCase() === 'AM' && h === 12) h = 0
    if (justNum[2].toUpperCase() === 'PM' && h !== 12) h += 12
    return `${h.toString().padStart(2, '0')}:00`
  }
  return ''
}

const inputStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: '13px', color: 'var(--color-text-primary)', padding: '2px 0',
  width: '80px',
}

interface Props {
  value: string        // HH:MM 24h or ''
  onChange: (v: string) => void
  placeholder?: string
}

export default function TimeInput({ value, onChange, placeholder = '3:00 PM' }: Props) {
  const [local, setLocal] = useState(() => fmt12(value))

  useEffect(() => { setLocal(fmt12(value)) }, [value])

  // Keep stable refs so the unmount cleanup always sees the latest values
  const localRef = useRef(local)
  const onChangeRef = useRef(onChange)
  useEffect(() => { localRef.current = local }, [local])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Commit pending typed value when the component unmounts (e.g., cell deactivated by single-click)
  useEffect(() => {
    return () => {
      const parsed = parse12(localRef.current)
      if (parsed) onChangeRef.current(parsed)
    }
  }, [])

  const h24 = value && /^\d{2}:\d{2}$/.test(value) ? parseInt(value.split(':')[0]) : -1
  const isPM = h24 >= 12

  function commit(raw: string) {
    const parsed = parse12(raw)
    if (parsed) {
      onChange(parsed)
      setLocal(fmt12(parsed))
    } else {
      setLocal(fmt12(value))
    }
  }

  function toggleAmPm() {
    if (h24 < 0) return
    const [, m] = value.split(':')
    const newH = isPM ? h24 - 12 : h24 + 12
    const newVal = `${newH.toString().padStart(2, '0')}:${m}`
    onChange(newVal)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <input
        type="text"
        value={local}
        placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => commit(local)}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={toggleAmPm}
        style={{
          fontSize: '11px', fontWeight: '600', padding: '1px 5px', borderRadius: '4px',
          color: '#0BB5C7', backgroundColor: 'rgba(11,181,199,0.1)',
          border: 'none', cursor: h24 >= 0 ? 'pointer' : 'default',
          opacity: h24 >= 0 ? 1 : 0.4, flexShrink: 0, lineHeight: '16px',
        }}
      >
        {h24 >= 0 ? (isPM ? 'PM' : 'AM') : 'AM'}
      </button>
    </div>
  )
}
