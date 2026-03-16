import { createServiceClient } from '@/utils/supabase/service'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EmailInboxClient from './components/EmailInboxClient'
import type { SentEmail } from './types'

export default async function EmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const svc = createServiceClient()
  const [{ data: emails }, { data: settings }] = await Promise.all([
    svc.from('sent_emails').select('*').order('sent_at', { ascending: false }).limit(300),
    svc.from('email_settings').select('*').eq('id', 1).single(),
  ])

  return (
    <EmailInboxClient
      initialEmails={(emails ?? []) as SentEmail[]}
      initialReplyTo={settings?.reply_to ?? ''}
    />
  )
}
