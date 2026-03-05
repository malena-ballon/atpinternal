'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Invalid email or password. Please try again.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('status')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        setError('Account not found. Please contact your administrator.')
        await supabase.auth.signOut()
        return
      }

      if (profile.status === 'rejected') {
        setError('Your account access has been denied. Please contact the administrator.')
        await supabase.auth.signOut()
        return
      }

      if (profile.status === 'pending') {
        router.push('/pending')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-navy mb-1">Sign In</h1>
          <p className="text-sm text-slate-brand">Welcome back to ATP!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
                autoComplete="current-password"
                placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg bg-brand-cyan text-navy font-semibold text-sm hover:bg-brand-cyan-soft disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-2 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-brand">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-brand-cyan font-semibold hover:underline focus:outline-none"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}
