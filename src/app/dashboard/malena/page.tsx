'use client'

import { useState, useRef } from 'react'
import { Heart, Lock } from 'lucide-react'

const CODE = '052625'

export default function MalenaPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [unlocked, setUnlocked] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]
    next[i] = val.slice(-1)
    setDigits(next)
    setError(false)
    if (val && i < 5) inputs.current[i + 1]?.focus()
    if (next.every(d => d !== '') && next.join('') === CODE) {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setUnlocked(true) }, 1500)
    } else if (next.every(d => d !== '') && next.join('') !== CODE) {
      setError(true)
      setTimeout(() => {
        setDigits(['', '', '', '', '', ''])
        setError(false)
        inputs.current[0]?.focus()
      }, 600)
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const next = pasted.split('')
      setDigits(next)
      if (next.join('') === CODE) { setSuccess(true); setTimeout(() => { setSuccess(false); setUnlocked(true) }, 1500) }
      else { setError(true); setTimeout(() => { setDigits(['', '', '', '', '', '']); setError(false); inputs.current[0]?.focus() }, 600) }
    }
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '70vh' }}>
        <div
          className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', width: '340px' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ backgroundColor: error ? 'rgba(225,29,72,0.1)' : 'rgba(225,29,72,0.08)' }}
          >
            <Lock size={26} style={{ color: error ? '#E11D48' : '#E11D48' }} />
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Guess the Code</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Enter the 6-digit code to continue</p>

          <div className="flex gap-2 mb-4" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="text-center text-xl font-bold rounded-xl outline-none transition-all"
                style={{
                  width: '44px',
                  height: '52px',
                  border: `2px solid ${error ? '#E11D48' : d ? '#E11D48' : 'var(--color-border)'}`,
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                }}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm font-medium" style={{ color: '#E11D48' }}>Incorrect code. Try again.</p>
          )}
          {success && (
            <p className="text-xl font-bold animate-bounce" style={{ color: '#E11D48' }}>Yehey! 🥰</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-l mb-6" style={{ color: 'var(--color-text-primary)' }}>
        Mark Russell Dancis Caranzo&apos;s 24th Birthday
      </h1>

      <div
        className="rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          minHeight: '400px'
        }}
      >
        <Heart
          size={56}
          className="mb-6 animate-pulse"
          style={{ color: '#E11D48' }}
          fill="#E11D48"
        />

        <h2
          className="text-4xl md:text-5xl font-extrabold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Happy Birthday, Love!
        </h2>

        <p
          className="text-lg max-w-xl mt-2 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          insert mssg
        </p>
      </div>
    </div>
  )
}
