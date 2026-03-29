import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Allow 10 login attempts per IP per 15 minutes
const RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 }

export async function POST(req: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = rateLimit(`login:${ip}`, RATE_LIMIT)
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000)
    console.warn(`[auth/login] Rate limit exceeded ip=${ip}`)
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
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

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).email !== 'string' ||
    typeof (body as Record<string, unknown>).password !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  }

  const email = ((body as Record<string, unknown>).email as string).trim().toLowerCase().slice(0, 255)
  const password = ((body as Record<string, unknown>).password as string).slice(0, 128)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  }

  // ── Supabase auth ────────────────────────────────────────────────────────────
  // Collect cookies to set on the response
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

  const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  if (authError || !data.user) {
    console.warn(`[auth/login] Failed attempt ip=${ip} error=${authError?.message}`)
    // Return a generic message — never reveal whether email exists
    return NextResponse.json(
      { error: 'Invalid email or password. Please try again.' },
      { status: 401 },
    )
  }

  // ── Fetch approval status ────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('status')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    console.error(`[auth/login] Profile missing userId=${data.user.id}`)
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'Account not found. Please contact your administrator.' },
      { status: 403 },
    )
  }

  if (profile.status === 'rejected') {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'Your account access has been denied. Please contact the administrator.' },
      { status: 403 },
    )
  }

  console.log(`[auth/login] Success ip=${ip} status=${profile.status}`)

  // ── Build response with auth cookies ────────────────────────────────────────
  const res = NextResponse.json({ status: profile.status })
  for (const { name, value, options } of pendingCookies) {
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
  }
  return res
}
