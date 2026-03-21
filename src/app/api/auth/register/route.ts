import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/utils/supabase/service'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Allow 5 registrations per IP per hour
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }

export async function POST(req: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = rateLimit(`register:${ip}`, RATE_LIMIT)
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000)
    console.warn(`[auth/register] Rate limit exceeded ip=${ip}`)
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      },
    )
  }

  // ── Parse & validate input ───────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : ''
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 255) : ''
  const password = typeof b.password === 'string' ? b.password.slice(0, 128) : ''

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  }

  // Name: only printable Unicode, no control characters or suspicious HTML
  if (/[<>{}]/.test(name)) {
    return NextResponse.json({ error: 'Name contains invalid characters.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  // Require at least one letter and one digit
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: 'Password must contain at least one letter and one number.' },
      { status: 400 },
    )
  }

  // ── Supabase sign-up ─────────────────────────────────────────────────────────
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          for (const c of toSet) pendingCookies.push(c)
        },
      },
    },
  )

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (signUpError) {
    console.warn(`[auth/register] signUp error email=${email} ip=${ip} error=${signUpError.message}`)
    return NextResponse.json({ error: signUpError.message }, { status: 400 })
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  // Email confirmation required — session will be null
  if (!data.session) {
    console.log(`[auth/register] Confirmation email sent email=${email} ip=${ip}`)
    const res = NextResponse.json({ needsConfirmation: true })
    for (const { name: n, value, options } of pendingCookies) {
      res.cookies.set(n, value, options as Parameters<typeof res.cookies.set>[2])
    }
    return res
  }

  // ── Create user profile (service client bypasses RLS) ────────────────────────
  const svc = createServiceClient()

  const { data: teacher } = await svc
    .from('teachers')
    .select('id')
    .eq('email', email)
    .is('user_id', null)
    .maybeSingle()

  const status: 'active' | 'pending' = teacher ? 'active' : 'pending'

  await svc.from('users').upsert(
    { id: data.user.id, name, email, role: 'teacher', status },
    { onConflict: 'id' },
  )

  if (teacher) {
    await svc.from('teachers').update({ user_id: data.user.id }).eq('id', teacher.id)
  }

  console.log(`[auth/register] Success userId=${data.user.id} ip=${ip} status=${status}`)

  const res = NextResponse.json({ status })
  for (const { name: n, value, options } of pendingCookies) {
    res.cookies.set(n, value, options as Parameters<typeof res.cookies.set>[2])
  }
  return res
}
