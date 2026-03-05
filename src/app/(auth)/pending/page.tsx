import Image from 'next/image'
import { Clock, XCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, status')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'active') redirect('/dashboard')

  const isRejected = profile?.status === 'rejected'

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image
          src="/logo.jpg"
          alt="Acadgenius Tutorial Powerhouse"
          width={96}
          height={96}
          priority
        />
        <p className="text-brand-cyan-soft text-sm font-medium tracking-widest uppercase">
          Acadgenius Tutorial Powerhouse
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl p-8 shadow-[0_16px_48px_rgba(10,16,69,0.4)] text-center">
        {isRejected ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle size={32} className="text-danger" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-navy mb-2">Access Denied</h1>
            <p className="text-sm text-slate-brand leading-relaxed mb-1">
              Your account registration has been reviewed and was not approved.
            </p>
            <p className="text-sm text-slate-brand leading-relaxed mb-8">
              If you believe this is a mistake, please reach out to your administrator directly.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock size={32} className="text-warning" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-navy mb-2">Account Pending Approval</h1>
            {profile?.name && (
              <p className="text-sm font-semibold text-brand-cyan mb-1">Hi, {profile.name}!</p>
            )}
            <p className="text-sm text-slate-brand leading-relaxed mb-8">
              Your account is pending admin approval. You&apos;ll be notified once it&apos;s
              reviewed. This usually takes less than 24 hours.
            </p>
          </>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="w-full py-3 px-6 rounded-lg border-2 border-navy text-navy font-semibold text-sm hover:bg-navy/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
