-- =============================================
-- KSU CONNECT - FIX SIGNUP & PROFILE CREATION
-- Run this if profiles are empty after signup
-- =============================================

-- 1. Auto-create a profile row whenever a new user signs up in auth.users
--    (safety net in case the app's manual insert fails)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  -- Try to read username/full_name from the user's metadata set during signUp
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    ''
  );

  -- Ensure username is unique by appending a short suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || floor(random() * 1000)::int;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, is_private, is_verified, is_admin, is_suspended,
                                followers_count, following_count, posts_count)
  VALUES (NEW.id, v_username, NULLIF(v_full_name, ''), false, false, false, false, 0, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Also create a free subscription row
  INSERT INTO public.subscriptions (user_id, status, plan, amount_paid, currency, starts_at, expires_at)
  VALUES (NEW.id, 'free', 'free', 0, 'NGN', NOW(), NULL)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 2. Backfill: for every existing auth.users that has no profile row, create one
INSERT INTO public.profiles (id, username, full_name, is_private, is_verified, is_admin, is_suspended,
                              followers_count, following_count, posts_count)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 6)),
  NULLIF(u.raw_user_meta_data->>'full_name', ''),
  false, false, false, false, 0, 0, 0
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Backfill: create a free subscription for any auth user who doesn't have one
INSERT INTO public.subscriptions (user_id, status, plan, amount_paid, currency, starts_at, expires_at)
SELECT u.id, 'free', 'free', 0, 'NGN', NOW(), NULL
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;

-- 4. Make sure the 'profiles are viewable by everyone' policy exists
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- DONE. Now go to Supabase > Authentication > Providers > Email
-- and turn OFF "Confirm email" so users can sign up and log in immediately.
