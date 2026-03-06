import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/auth', '/schedule']
const SEMI_PUBLIC_PATHS = ['/pending']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isSemiPublic = SEMI_PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // 1. If NO USER: allow public pages, otherwise force login
  if (!user) {
    if (isPublic || isSemiPublic) return supabaseResponse
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. If USER EXISTS: check their profile status
  const { data: profile } = await supabase
    .from('users')
    .select('status')
    .eq('id', user.id)
    .single()

  const status = profile?.status || 'pending'

  // 3. Prevent logged-in users from seeing login/register
  if (isPublic) {
    const target = status === 'active' ? '/dashboard' : '/pending'
    return NextResponse.redirect(new URL(target, request.url))
  }

  // 4. Force pending users to /pending
  if ((status === 'pending' || status === 'rejected') && !isSemiPublic) {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // 5. Active users shouldn't be on /pending
  if (status === 'active' && isSemiPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any file with an extension (svg, png, jpg, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}