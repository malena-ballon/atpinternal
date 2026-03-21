'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const e = params.get('email')
    if (e) setEmail(e)
  }, [])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many registration attempts. Please try again later.')
        } else {
          setError(data.error ?? 'Registration failed. Please try again.')
        }
        return
      }

      if (data.needsConfirmation) {
        setCheckEmail(true)
        return
      }

      if (data.status === 'active') {
        router.push('/dashboard')
      } else {
        router.push('/pending')
      }
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Image src="/logo.jpg" alt="Acadgenius Tutorial Powerhouse" width={96} height={96} priority />
          <p className="text-brand-cyan-soft text-sm font-medium tracking-widest uppercase">
            Acadgenius Tutorial Powerhouse
          </p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-[0_16px_48px_rgba(10,16,69,0.4)] flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,181,199,0.1)' }}>
            <Mail size={28} style={{ color: '#0BB5C7' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy mb-1">Check your email</h2>
            <p className="text-sm text-slate-brand">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </p>
          </div>
          <p className="text-xs text-gray-400">Didn&apos;t get it? Check your spam folder.</p>
          <Link href="/login" className="text-brand-cyan text-sm font-semibold hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image
          src="/logo.jpg"
          alt="Acadgenius Tutorial Powerhouse"
          width={96}
          height={96}
          priority
        />
        <p className="text-brand-cyan-soft text-sm font-medium tracking-widest uppercase">
          Acadgenius Tutorial Powerhouse
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl p-8 shadow-[0_16px_48px_rgba(10,16,69,0.4)]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy mb-1">Create Account</h1>
          <p className="text-sm text-slate-brand">Join the Acadgenius team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Your full name"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-navy placeholder-gray-400 text-sm focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-navy placeholder-gray-400 text-sm focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Min. 8 characters, letter + number"
                className="w-full px-4 py-3 pr-11 rounded-lg border border-gray-200 text-navy placeholder-gray-400 text-sm focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat your password"
                className="w-full px-4 py-3 pr-11 rounded-lg border border-gray-200 text-navy placeholder-gray-400 text-sm focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy transition-colors"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg bg-brand-cyan text-navy font-semibold text-sm hover:bg-brand-cyan-soft disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-2 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-brand">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-brand-cyan font-semibold hover:underline focus:outline-none"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
