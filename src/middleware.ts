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
  // TEMP: Let everything through to see if the page actually exists
  return NextResponse.next()
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