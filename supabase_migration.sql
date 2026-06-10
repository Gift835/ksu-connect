-- =============================================
-- KSU CONNECT - MIGRATION (run AFTER the original schema)
-- Adds new columns, tables, triggers, RLS, and storage policies
-- Safe to run on top of your existing schema
-- =============================================

-- =============================================
-- 1. ADD NEW COLUMNS TO EXISTING TABLES
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON public.profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles(is_suspended);

-- =============================================
-- 2. NEW TABLES: promo_codes, promo_redemptions, subscriptions, payments, admin_actions
-- =============================================

-- PROMO CODES
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promo codes viewable by authenticated users" ON public.promo_codes;
CREATE POLICY "Promo codes viewable by authenticated users" ON public.promo_codes FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage promo codes" ON public.promo_codes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- PROMO REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, promo_code_id)
);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can view own redemptions" ON public.promo_redemptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can insert own redemptions" ON public.promo_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.promo_redemptions;
CREATE POLICY "Admins can view all redemptions" ON public.promo_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'active', 'expired', 'cancelled', 'suspended')),
  plan TEXT DEFAULT 'monthly' CHECK (plan IN ('free', 'monthly')),
  amount_paid NUMERIC(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  payment_provider TEXT,
  payment_reference TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_by_promo_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  payment_provider TEXT DEFAULT 'paystack',
  paystack_reference TEXT UNIQUE,
  paystack_authorization_url TEXT,
  paystack_access_code TEXT,
  paystack_channel TEXT,
  paystack_paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ADMIN ACTIONS LOG
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin actions" ON public.admin_actions;
CREATE POLICY "Admins can view admin actions" ON public.admin_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can insert admin actions" ON public.admin_actions;
CREATE POLICY "Admins can insert admin actions" ON public.admin_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- =============================================
-- 3. ADMIN-LEVEL UPDATE POLICIES (for suspension etc)
-- =============================================
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
CREATE POLICY "Admins can delete any post" ON public.posts FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins can delete any comment" ON public.comments FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- =============================================
-- 4. SUSPENSION TRIGGERS (block suspended users from posting/liking/commenting)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_user_suspended()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_suspended = true) THEN
    RAISE EXCEPTION 'Your account is suspended. Contact support.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_block_suspended_posts ON public.posts;
CREATE TRIGGER trg_block_suspended_posts
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.check_user_suspended();

DROP TRIGGER IF EXISTS trg_block_suspended_comments ON public.comments;
CREATE TRIGGER trg_block_suspended_comments
BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.check_user_suspended();

DROP TRIGGER IF EXISTS trg_block_suspended_likes ON public.likes;
CREATE TRIGGER trg_block_suspended_likes
BEFORE INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.check_user_suspended();

-- =============================================
-- 5. AUTO-CREATE FREE SUBSCRIPTION ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan, amount_paid, currency, starts_at, expires_at)
  VALUES (NEW.id, 'free', 'free', 0, 'NGN', NOW(), NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_subscription_on_signup ON public.profiles;
CREATE TRIGGER trg_create_subscription_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- =============================================
-- 6. STORAGE: add covers bucket + policies
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;
CREATE POLICY "Anyone can view covers" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
DROP POLICY IF EXISTS "Auth users can upload covers" ON storage.objects;
CREATE POLICY "Auth users can upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update own covers" ON storage.objects;
CREATE POLICY "Users can update own covers" ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- =============================================
-- 7. REALTIME subscriptions for new tables
-- =============================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =============================================
-- 8. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);

-- =============================================
-- 9. BACKFILL: Create a free subscription for any existing user who doesn't have one
-- =============================================
INSERT INTO public.subscriptions (user_id, status, plan, amount_paid, currency, starts_at, expires_at)
SELECT p.id, 'free', 'free', 0, 'NGN', NOW(), NULL
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- 10. GRANT FIRST ADMIN
-- Replace the UUID below with your user's auth.users.id
-- You can find it in Supabase > Authentication > Users
-- =============================================
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE id = 'YOUR-USER-UUID-HERE';

-- =============================================
-- DONE! Your KSU Connect database is ready.
-- =============================================
