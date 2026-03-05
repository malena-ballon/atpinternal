-- ============================================================
-- Classes & Sessions enhancements
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Apply this via Supabase SQL editor or `supabase db push`.
-- ============================================================

ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'rescheduled';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS original_date DATE;

ALTER TABLE classes ADD COLUMN IF NOT EXISTS rate NUMERIC(10,2);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS at_risk_threshold NUMERIC(5,2);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS score_brackets JSONB;
