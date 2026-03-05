-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'teacher');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'rejected');
CREATE TYPE class_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- ============================================================
-- Helper: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- users
-- Extends auth.users. Role + approval status managed here.
-- ============================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        user_role   NOT NULL DEFAULT 'teacher',
  status      user_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- classes
-- ============================================================

CREATE TABLE classes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  description         TEXT,
  zoom_link           TEXT,
  status              class_status NOT NULL DEFAULT 'active',
  default_passing_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- subjects
-- Belong to a class.
-- ============================================================

CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- teachers
-- Linked to a user account (nullable so teachers can exist
-- before a login is provisioned).
-- ============================================================

CREATE TABLE teachers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  specialization TEXT,
  email          TEXT NOT NULL UNIQUE,
  -- availability stored as JSON, e.g. [{"day":"Monday","slots":["09:00","10:00"]}]
  availability   JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- sessions
-- Belong to class + subject, assigned to a teacher.
-- ============================================================

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  subject_id    UUID          REFERENCES subjects(id)  ON DELETE SET NULL,
  teacher_id    UUID          REFERENCES teachers(id)  ON DELETE SET NULL,
  date          DATE        NOT NULL,
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  status        session_status NOT NULL DEFAULT 'scheduled',
  notes         TEXT,
  zoom_link     TEXT,
  student_count INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_end_after_start CHECK (end_time > start_time)
);

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- students
-- ============================================================

CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  school     TEXT,
  email      TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- class_students
-- Many-to-many: students ↔ classes.
-- ============================================================

CREATE TABLE class_students (
  class_id    UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);

-- ============================================================
-- exams
-- Belong to class & subject, has many scores.
-- passing_pct_override: when set, overrides the class default.
-- ============================================================

CREATE TABLE exams (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id             UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  subject_id           UUID          REFERENCES subjects(id) ON DELETE SET NULL,
  name                 TEXT        NOT NULL,
  date                 DATE,
  total_items          INTEGER     NOT NULL CHECK (total_items > 0),
  passing_pct_override NUMERIC(5,2) CHECK (passing_pct_override BETWEEN 0 AND 100),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- scores
-- Belong to exam & student.
-- percentage is computed and stored automatically.
-- ============================================================

CREATE TABLE scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     UUID        NOT NULL REFERENCES exams(id)    ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  raw_score   NUMERIC(8,2) NOT NULL CHECK (raw_score >= 0),
  total_items INTEGER      NOT NULL CHECK (total_items > 0),
  percentage  NUMERIC(5,2) GENERATED ALWAYS AS (
                ROUND((raw_score / total_items::NUMERIC) * 100, 2)
              ) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_subjects_class_id      ON subjects(class_id);
CREATE INDEX idx_sessions_class_id      ON sessions(class_id);
CREATE INDEX idx_sessions_teacher_id    ON sessions(teacher_id);
CREATE INDEX idx_sessions_date          ON sessions(date);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_exams_class_id         ON exams(class_id);
CREATE INDEX idx_scores_exam_id         ON scores(exam_id);
CREATE INDEX idx_scores_student_id      ON scores(student_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores        ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is the current user an active teacher?
CREATE OR REPLACE FUNCTION is_active_teacher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'teacher' AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- users: each user reads their own row; admins read all
CREATE POLICY "users: read own" ON users
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "users: admin full" ON users
  FOR ALL USING (is_admin());

-- classes: active users can read; admins can write
CREATE POLICY "classes: read" ON classes
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "classes: admin write" ON classes
  FOR ALL USING (is_admin());

-- subjects
CREATE POLICY "subjects: read" ON subjects
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "subjects: admin write" ON subjects
  FOR ALL USING (is_admin());

-- teachers: read all active; admin writes
CREATE POLICY "teachers: read" ON teachers
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "teachers: admin write" ON teachers
  FOR ALL USING (is_admin());

-- sessions: read all; teachers can update their own sessions
CREATE POLICY "sessions: read" ON sessions
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "sessions: admin write" ON sessions
  FOR ALL USING (is_admin());

CREATE POLICY "sessions: teacher update own" ON sessions
  FOR UPDATE USING (
    is_active_teacher() AND
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- students
CREATE POLICY "students: read" ON students
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "students: admin write" ON students
  FOR ALL USING (is_admin());

-- class_students
CREATE POLICY "class_students: read" ON class_students
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "class_students: admin write" ON class_students
  FOR ALL USING (is_admin());

-- exams
CREATE POLICY "exams: read" ON exams
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "exams: admin write" ON exams
  FOR ALL USING (is_admin());

-- scores
CREATE POLICY "scores: read" ON scores
  FOR SELECT USING (is_admin() OR is_active_teacher());

CREATE POLICY "scores: admin write" ON scores
  FOR ALL USING (is_admin());
