-- Student portal access codes
-- One code per student, used to access their individual report at /portal

CREATE TABLE IF NOT EXISTS student_portal_codes (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  code       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow service role full access (used by server actions)
ALTER TABLE student_portal_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON student_portal_codes
  USING (false)
  WITH CHECK (false);
