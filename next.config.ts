import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Block page from being embedded in frames (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Enable browser XSS filter (legacy browsers)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Control referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Enforce HTTPS for 2 years, include subdomains, allow preload
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  // Prevent Adobe Flash / PDF cross-domain requests
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // Isolate browsing context — mitigates Spectre/cross-origin attacks
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Prevent other origins from loading this site's resources
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for styles; tighten with nonces in future
      "style-src 'self' 'unsafe-inline'",
      // Next.js hydration + TipTap require unsafe-eval in dev; restrict in prod via env
      process.env.NODE_ENV === 'development'
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline'",
      // Supabase API + Resend image tracking
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://*.supabase.co wss://*.supabase.co`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  reactCompiler: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Apply security headers to all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
