-- sent_emails: log of every email dispatched through the system
CREATE TABLE IF NOT EXISTS sent_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT        NOT NULL,
  to_addresses JSONB      NOT NULL DEFAULT '[]', -- [{name, email}]
  type        TEXT        NOT NULL DEFAULT 'general',
  context     TEXT,                               -- e.g. class name, "Teacher invite"
  sent_count  INT         NOT NULL DEFAULT 0,
  failed_count INT        NOT NULL DEFAULT 0,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- email_settings: single-row config (reply-to forwarding address)
CREATE TABLE IF NOT EXISTS email_settings (
  id        INT  PRIMARY KEY DEFAULT 1,
  reply_to  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_settings_single_row CHECK (id = 1)
);

INSERT INTO email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE sent_emails   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read; inserts happen via service client (bypasses RLS)
CREATE POLICY "admins_read_sent_emails"
  ON sent_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "admins_read_email_settings"
  ON email_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "admins_update_email_settings"
  ON email_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
