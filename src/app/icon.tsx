import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <img
        src={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/logo.jpg`}
        width={32}
        height={32}
        style={{ borderRadius: '8px', objectFit: 'cover' }}
      />
    ),
    { ...size },
  )
}
