ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
-- [{filename: string, storage_path?: string, recipient_email?: string}]

-- Create storage bucket for email attachment PDFs (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', false, 10485760)
ON CONFLICT DO NOTHING;

-- Only service role (bypasses RLS) can insert; admins can read via signed URLs generated server-side
