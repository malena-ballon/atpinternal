-- Add portal theme color setting to email_settings
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS portal_theme TEXT DEFAULT '#1E3A5F';
