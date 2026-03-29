'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { updateAvatar } from '@/app/actions'

interface Props {
  name: string
  avatarUrl: string | null
  size?: number
}

export default function AvatarUpload({ name, avatarUrl, size = 36 }: Props) {
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [isPending, startTransition] = useTransition()
  const localUrlRef = useRef<string | null>(null)

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Revoke any previous object URL
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current)
    const localUrl = URL.createObjectURL(file)
    localUrlRef.current = localUrl
    setPreview(localUrl)

    const formData = new FormData()
    formData.append('avatar', file)

    startTransition(async () => {
      const result = await updateAvatar(formData)
      if (!result.ok) {
        setPreview(avatarUrl) // revert on failure
      } else if (result.url) {
        URL.revokeObjectURL(localUrl)
        localUrlRef.current = null
        setPreview(result.url)
      }
    })
  }

  return (
    <div
      className="relative group shrink-0"
      style={{ width: size, height: size }}
      title="Change profile picture"
    >
      {/* Avatar display */}
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white select-none"
        style={{ backgroundColor: '#0BB5C7', fontSize: Math.round(size * 0.35) }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Hover / loading overlay */}
      <div
        className={`absolute inset-0 rounded-full flex items-center justify-center pointer-events-none transition-opacity ${isPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        {isPending
          ? <Loader2 size={Math.round(size * 0.42)} color="white" className="animate-spin" />
          : <Camera size={Math.round(size * 0.42)} color="white" />
        }
      </div>

      {/* File input covers the whole avatar */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="absolute inset-0 w-full h-full rounded-full opacity-0"
        style={{ cursor: isPending ? 'not-allowed' : 'pointer' }}
        onChange={handleChange}
        disabled={isPending}
      />
    </div>
  )
}
