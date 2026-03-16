export interface SentEmail {
  id: string
  subject: string
  to_addresses: { name: string; email: string }[]
  type: string
  context: string | null
  body: string | null
  sent_by: string | null
  attachments: { filename: string; storage_path?: string; recipient_email?: string }[]
  sent_count: number
  failed_count: number
  sent_at: string
}
