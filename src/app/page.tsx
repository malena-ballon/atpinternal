import { redirect } from 'next/navigation'

export default function Home() {
  // Change this from /dashboard to /login
  redirect('/login') 
}