-- ============================================================
-- 1. Allow teachers to update their own teacher row
-- ============================================================
CREATE POLICY "teachers: update own" ON teachers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 2. Activity logs
-- ============================================================
CREATE TABLE activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT        NOT NULL,
  action      TEXT        NOT NULL,  -- e.g. 'updated_profile', 'saved_sessions', 'added_score'
  entity_type TEXT        NOT NULL,  -- 'teacher', 'session', 'class', 'exam', etc.
  entity_id   TEXT,
  entity_name TEXT,
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "logs: admin read" ON activity_logs
  FOR SELECT USING (is_admin());

-- Anyone authenticated can insert their own log entry
CREATE POLICY "logs: insert authenticated" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
