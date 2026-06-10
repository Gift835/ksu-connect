-- =============================================
-- KSU CONNECT - Add 'live' plan to subscriptions
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Allow 'live' as a valid plan value in subscriptions table
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_plan_check
CHECK (plan IN ('free', 'monthly', 'live'));