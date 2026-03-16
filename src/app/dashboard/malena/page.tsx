'use client'

import { useState, useRef } from 'react'
import { Heart, Lock } from 'lucide-react'

const CODE = '052625'

const MESSAGE_PARAGRAPHS = [
  `Some of my friends have asked me, "Why Mark?" My answer always goes along the lines of, "Because he's kind." I know it sounds like the simplest answer in the world, but I don't think most people recognize how much depth that word carries, which I understand because I couldn't have fully realized it either until I met you, and even now, I still find myself with no better answer in a casual conversation than this seemingly simple word that manages to radiate through every aspect of you.`,
  `I see it in the way you remain calm after conversations that could have gone sideways. When I share something I was afraid to say, I feel seen in a way that has taught me that my words will always land softly with you. I walk away from the conversation relieved, and inexplicably wanting to be even closer to you. Moments like these remind me how rare and precious what we have truly is.`,
  `I see it in the way you respected the space I needed when my life felt chaotic and disorganized. You never made me feel guilty for asking. You simply gave me what I needed, without expectation. You showed me that your love does not require me to be put together in order to deserve it. It made me feel safe to grow at my own pace, with the reassurance that taking the time I needed would never change what we have.`,
  `I see it in the way you show up even when you're tired, even when ATP and law class fall on the same day, and every part of you could be justified in choosing rest. You come anyway, simply because you want to, and each time, I am reminded just how deeply loved I am by you.`,
  `And I see it in the smallest things too, the ones that aren't overtly emotional but somehow feel just as telling. When you know my order (daing na bangus sa kanto, achara with anything grilled, pizza? basta thin crust hahaha), I find myself so happy knowing that the little details that make me me have a place in your mind. That I am known by you in simplest and most ordinary ways that are mine.`,
  `And I see it every time we part, when you thank me for my time and my presence, as if an evening with me is something you consider yourself fortunate to have had. Every single time (secret lang 'to eh… but I wait for it every time jk), it catches me a little off guard and means more than I know how to say out loud, that someone is genuinely grateful simply for my company. It quiets the part of me that has always been afraid of taking up too much space in someone's life. Thank you, Love.`,
  `These are not grand gestures, but they are so entirely you, and that is why I choose you, not for what you do in the extraordinary moments, but for who you are in the ordinary ones, in the quiet, steady, and everyday kindness that makes you, you. There is so much about you that I admire and aspire to carry within myself. These are the things that run through my mind every time someone asks me why—thoughts I could never quite fit into a casual conversation, but that I have always wanted you to know.`,
  `So much has already happened in just over a year, and in each of those moments, whether joyful or difficult, I'm thankful and happy that it was you I experienced them with. Wherever the future takes us, I believe we will be okay, not because the roads will always be easy, but because we have always known how to be kind to each other. I want you to know that you can always count on me, Love. I will walk alongside you and love you through all the seasons of your life. I'm excited for the many chapters we have yet to live through together, and I have no doubt that you will succeed in everything you are striving for. Siyempre, si Mark Russell Dancis Caranzo ka eh! Happy 24th Birthday, Love. I love you!`,
  'Love,',
  'Your Girlfriend :)',
]

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
            <Lock size={26} style={{ color: '#E11D48' }} />
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
          minHeight: '400px',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <Heart
          size={48}
          className="mb-6 animate-pulse"
          style={{ color: '#E11D48' }}
          fill="#E11D48"
        />

        <h2
          className="text-3xl md:text-4xl font-extrabold mb-6"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Happy Birthday, Love!
        </h2>

        <div className="space-y-4 max-w-2xl text-left">
          {MESSAGE_PARAGRAPHS.map((para, i) => (
            <p
              key={i}
              className="text-xs leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
