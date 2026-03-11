-- ============================================================
-- Ensure the auth trigger function exists and fires correctly.
-- Safe to run multiple times (CREATE OR REPLACE + DROP IF EXISTS).
-- ============================================================

-- Recreate the function to be safe
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

-- Drop and recreate the trigger to ensure it's attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Allow service role to update user status (needed for ensureUserProfile)
-- (Service role bypasses RLS by default, this is just documentation)
