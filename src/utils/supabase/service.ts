import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Server-only. Never expose to the client.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never NEXT_PUBLIC_).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
