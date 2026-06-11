-- =============================================
-- FIX: Follow/Followers Count Not Updating
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create a function to increment followers/following counts
CREATE OR REPLACE FUNCTION public.handle_follow_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment followers_count on the user being followed (following_id)
    UPDATE public.profiles
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;

    -- Increment following_count on the follower (follower_id)
    UPDATE public.profiles
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to decrement on unfollow
CREATE OR REPLACE FUNCTION public.handle_follow_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrement followers_count
    UPDATE public.profiles
    SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;

    -- Decrement following_count
    UPDATE public.profiles
    SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_follow_insert ON public.follows;
DROP TRIGGER IF EXISTS trg_follow_delete ON public.follows;

-- 4. Create the triggers
CREATE TRIGGER trg_follow_insert
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_follow_insert();

CREATE TRIGGER trg_follow_delete
AFTER DELETE ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_follow_delete();

-- 5. Fix any existing incorrect counts
UPDATE public.profiles p
SET followers_count = (
    SELECT COUNT(*) FROM public.follows WHERE following_id = p.id AND status = 'accepted'
);

UPDATE public.profiles p
SET following_count = (
    SELECT COUNT(*) FROM public.follows WHERE follower_id = p.id AND status = 'accepted'
);

-- 6. Grant proper permissions (SECURITY DEFINER already handles this)
-- The triggers run with the privileges of the function owner (postgres)
-- so they bypass RLS completely