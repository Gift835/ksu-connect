-- ============================================================
-- KSU Connect: Add plan_type to promo_codes
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add plan_type column to promo_codes
--    Values: 'monthly' (₦300 Premium) or 'live' (₦500 Live Streamer)
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'monthly'
  CHECK (plan_type IN ('monthly', 'live'));

-- 2. Add a comment for documentation
COMMENT ON COLUMN promo_codes.plan_type IS
  'The plan this promo code unlocks: monthly (₦300 Premium) or live (₦500 Live Streamer)';

-- 3. Backfill any existing codes with the default plan
UPDATE promo_codes SET plan_type = 'monthly' WHERE plan_type IS NULL;
