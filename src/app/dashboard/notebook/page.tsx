import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import NotebookClient, { type NoteRow } from './components/NotebookClient'

export default async function NotebookPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  return <NotebookClient initialNotes={(notes ?? []) as unknown as NoteRow[]} />
}
