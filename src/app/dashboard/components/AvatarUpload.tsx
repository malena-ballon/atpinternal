'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Check, X } from 'lucide-react'
import { updateAvatar } from '@/app/actions'

const CROP_SIZE = 260

interface Props {
  name: string
  avatarUrl: string | null
  size?: number
}

function clampOffset(val: number, scaledDim: number): number {
  const max = Math.max(0, (scaledDim - CROP_SIZE) / 2)
  return Math.max(-max, Math.min(max, val))
}

export default function AvatarUpload({ name, avatarUrl, size = 36 }: Props) {
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)
  const cropUrlRef = useRef<string | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    fileRef.current = file

    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current)
    const url = URL.createObjectURL(file)
    cropUrlRef.current = url

    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const s = Math.max(CROP_SIZE / w, CROP_SIZE / h)
      setNaturalSize({ w, h })
      setScale(s)
      setOffset({ x: 0, y: 0 })
      setCropSrc(url)
    }
    img.src = url

    // Reset input so same file can be re-selected after cancel
    if (inputRef.current) inputRef.current.value = ''
  }

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = { sx: clientX, sy: clientY, ox: offset.x, oy: offset.y }

    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return
      const { clientX: cx, clientY: cy } = 'touches' in e ? e.touches[0] : e
      const dx = cx - dragRef.current.sx
      const dy = cy - dragRef.current.sy
      setOffset({
        x: clampOffset(dragRef.current.ox + dx, naturalSize.w * scale),
        y: clampOffset(dragRef.current.oy + dy, naturalSize.h * scale),
      })
    }
    function onEnd() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
  }

  function handleCancel() {
    setCropSrc(null)
    if (cropUrlRef.current) { URL.revokeObjectURL(cropUrlRef.current); cropUrlRef.current = null }
    fileRef.current = null
  }

  function handleConfirm() {
    if (!cropSrc) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CROP_SIZE
      canvas.height = CROP_SIZE
      const ctx = canvas.getContext('2d')!
      const scaledW = naturalSize.w * scale
      const scaledH = naturalSize.h * scale
      const left = (CROP_SIZE - scaledW) / 2 + offset.x
      const top = (CROP_SIZE - scaledH) / 2 + offset.y
      ctx.drawImage(img, left, top, scaledW, scaledH)

      canvas.toBlob(blob => {
        if (!blob) return
        const localPreview = URL.createObjectURL(blob)
        setCropSrc(null)
        if (cropUrlRef.current) { URL.revokeObjectURL(cropUrlRef.current); cropUrlRef.current = null }

        setUploadError(null)
        setPreview(localPreview)

        const formData = new FormData()
        formData.append('avatar', new File([blob], fileRef.current?.name ?? 'avatar.jpg', { type: 'image/jpeg' }))

        startTransition(async () => {
          const result = await updateAvatar(formData)
          URL.revokeObjectURL(localPreview)
          if (!result.ok) {
            setPreview(avatarUrl)
            setUploadError(result.error ?? 'Upload failed. Please try again.')
          } else if (result.url) {
            setPreview(result.url)
          }
        })
      }, 'image/jpeg', 0.92)
    }
    img.src = cropSrc
  }

  return (
    <>
      {/* ── Crop modal ──────────────────────────────────────────────────── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl w-full max-w-xs">
            <h2 className="text-sm font-bold mb-0.5" style={{ color: '#111827' }}>Adjust Photo</h2>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>Drag to reposition within the circle</p>

            {/* Circular crop window */}
            <div
              className="relative mx-auto overflow-hidden rounded-full select-none"
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                cursor: 'grab',
                border: '3px solid #0BB5C7',
                backgroundColor: '#f3f4f6',
              }}
              onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
              onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropSrc}
                alt="crop"
                draggable={false}
                style={{
                  position: 'absolute',
                  width: naturalSize.w * scale,
                  height: naturalSize.h * scale,
                  left: (CROP_SIZE - naturalSize.w * scale) / 2 + offset.x,
                  top: (CROP_SIZE - naturalSize.h * scale) / 2 + offset.y,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCancel}
                className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ border: '1px solid #e5e7eb', color: '#6b7280' }}
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-1.5"
                style={{ backgroundColor: '#0BB5C7' }}
              >
                <Check size={14} /> Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Avatar button ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="relative group shrink-0"
          style={{ width: size, height: size }}
          title="Change profile picture"
        >
          <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white select-none"
            style={{ backgroundColor: '#0BB5C7', fontSize: Math.round(size * 0.35) }}
          >
            {preview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview} alt={name} className="w-full h-full object-cover" />
              : initials
            }
          </div>

          <div
            className={`absolute inset-0 rounded-full flex items-center justify-center pointer-events-none transition-opacity ${isPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {isPending
              ? <Loader2 size={Math.round(size * 0.42)} color="white" className="animate-spin" />
              : <Camera size={Math.round(size * 0.42)} color="white" />
            }
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="absolute inset-0 w-full h-full rounded-full opacity-0"
            style={{ cursor: isPending ? 'not-allowed' : 'pointer' }}
            onChange={handleFileChange}
            disabled={isPending}
          />
        </div>

        {uploadError && (
          <p className="text-xs text-center max-w-[120px]" style={{ color: 'var(--color-danger)' }}>{uploadError}</p>
        )}
      </div>
    </>
  )
}
