-- Session reminder tracking columns
-- Prevents duplicate reminder emails when cron runs multiple times

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reminder_6h_sent BOOLEAN NOT NULL DEFAULT false;
