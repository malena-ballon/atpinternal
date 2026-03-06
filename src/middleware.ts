import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Accessible without any session
const PUBLIC_PATHS = ['/login', '/register', '/auth', '/schedule']
// Accessible with a session regardless of approval status
const SEMI_PUBLIC_PATHS = ['/pending']

function redirectTo(request: NextRequest, pathname: string) {
  // This creates a fresh, clean URL based on your current domain
  return NextResponse.redirect(new URL(pathname, request.url))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isSemiPublic = SEMI_PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // ── No session ──────────────────────────────────────────────
  if (!user) {
    if (isPublic || isSemiPublic) return supabaseResponse
    return redirectTo(request, '/login')
  }

  // ── Authenticated: check approval status ────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('status')
    .eq('id', user.id)
    .single()

  const status = profile?.status

  // Already logged in → redirect away from auth pages
  if (isPublic) {
    return redirectTo(request, status === 'active' ? '/dashboard' : '/pending')
  }

  // Pending/rejected users can only access /pending
  if ((status === 'pending' || status === 'rejected') && !isSemiPublic) {
    return redirectTo(request, '/pending')
  }

  // Active users should not sit on /pending
  if (status === 'active' && isSemiPublic) {
    return redirectTo(request, '/dashboard')
  }

  // IMPORTANT: always return supabaseResponse so cookies stay in sync.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static, _next/image, favicon.ico
     * - all images/assets (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}