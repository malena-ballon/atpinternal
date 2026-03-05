import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

// Update this to your verified Resend sending domain/email
export const FROM_EMAIL = 'ATP Reminders <noreply@acadgenius.ph>'
