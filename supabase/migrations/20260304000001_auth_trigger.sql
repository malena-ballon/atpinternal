-- ============================================================
-- Fix users RLS policies & add trigger to auto-create profiles
-- ============================================================

-- Drop the overly-broad admin policy (FOR ALL with only USING
-- doesn't cover INSERT properly in PostgreSQL RLS).
DROP POLICY IF EXISTS "users: admin full" ON users;

-- Admin: full read/write with proper WITH CHECK on writes
CREATE POLICY "users: admin select" ON users
  FOR SELECT USING (is_admin());

CREATE POLICY "users: admin insert" ON users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "users: admin update" ON users
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "users: admin delete" ON users
  FOR DELETE USING (is_admin());

-- Any authenticated user can insert their OWN row (registration).
-- The trigger below handles this automatically, but this policy is
-- the safety net if anyone calls the insert directly.
CREATE POLICY "users: insert own" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- Trigger: auto-create users profile when auth.users gets a new row
-- This fires after supabase.auth.signUp() so we don't need a
-- client-side insert — name comes from user_metadata.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'teacher',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
