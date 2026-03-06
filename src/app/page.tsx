import { redirect } from 'next/navigation'

export default function Home() {
  // Send them directly to login
  redirect('/login')
}