/**
 * In-memory rate limiter.
 *
 * Works per process instance. For multi-instance or serverless deployments
 * each cold-start instance has its own counter — sufficient for deterrence
 * against bots but not a hard guarantee across all instances.
 * To enforce strict limits at scale, replace the Map with an Upstash Redis
 * or Vercel KV store.
 */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

// Prune expired buckets every 10 minutes so memory stays bounded
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k)
    }
  }, 10 * 60 * 1000)
  // Don't keep the Node.js process alive just for this timer
  timer.unref?.()
}

export interface RateLimitResult {
  allowed: boolean
  /** Attempts remaining in the current window */
  remaining: number
  /** Milliseconds until the window resets (0 when allowed) */
  retryAfterMs: number
}

/**
 * Check and increment the rate limit counter for `key`.
 * @param key      Unique bucket identifier, e.g. `login:1.2.3.4`
 * @param max      Maximum requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now()
  let bucket = store.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    store.set(key, bucket)
  }
  bucket.count++
  const allowed = bucket.count <= max
  return {
    allowed,
    remaining: Math.max(0, max - bucket.count),
    retryAfterMs: allowed ? 0 : bucket.resetAt - now,
  }
}

/** Extract the best available client IP from a Next.js request. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
