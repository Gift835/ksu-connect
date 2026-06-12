-- ============================================================
-- KSU Connect: Live Streaming and Auto-Updating Engagement Triggers
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create Live Streams Table
CREATE TABLE IF NOT EXISTS public.live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  viewer_count INTEGER DEFAULT 0
);

-- Enable RLS on live_streams
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for live_streams
DROP POLICY IF EXISTS "Anyone can view live streams" ON public.live_streams;
CREATE POLICY "Anyone can view live streams" ON public.live_streams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Hosts can insert own live streams" ON public.live_streams;
CREATE POLICY "Hosts can insert own live streams" ON public.live_streams FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update own live streams" ON public.live_streams;
CREATE POLICY "Hosts can update own live streams" ON public.live_streams FOR UPDATE USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete own live streams" ON public.live_streams;
CREATE POLICY "Hosts can delete own live streams" ON public.live_streams FOR DELETE USING (auth.uid() = host_id);


-- 2. Follows Count Triggers
CREATE OR REPLACE FUNCTION public.handle_follow_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;

    UPDATE public.profiles
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_follow_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;

    UPDATE public.profiles
    SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_insert ON public.follows;
CREATE TRIGGER trg_follow_insert
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_insert();

DROP TRIGGER IF EXISTS trg_follow_delete ON public.follows;
CREATE TRIGGER trg_follow_delete
AFTER DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_delete();


-- 3. Posts Count Triggers
CREATE OR REPLACE FUNCTION public.handle_post_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET posts_count = posts_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_post_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET posts_count = GREATEST(0, posts_count - 1)
    WHERE id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_insert ON public.posts;
CREATE TRIGGER trg_post_insert
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_post_insert();

DROP TRIGGER IF EXISTS trg_post_delete ON public.posts;
CREATE TRIGGER trg_post_delete
AFTER DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_post_delete();


-- 4. Comments Count Triggers (Updates posts.comments_count)
CREATE OR REPLACE FUNCTION public.handle_comment_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_comment_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_insert ON public.comments;
CREATE TRIGGER trg_comment_insert
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_insert();

DROP TRIGGER IF EXISTS trg_comment_delete ON public.comments;
CREATE TRIGGER trg_comment_delete
AFTER DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_delete();


-- 5. Likes Count Triggers (Updates posts.likes_count & comments.likes_count)
CREATE OR REPLACE FUNCTION public.handle_like_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.target_type = 'post' THEN
        UPDATE public.posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
        UPDATE public.comments
        SET likes_count = likes_count + 1
        WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_like_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.target_type = 'post' THEN
        UPDATE public.posts
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = OLD.target_id;
    ELSIF OLD.target_type = 'comment' THEN
        UPDATE public.comments
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_like_insert ON public.likes;
CREATE TRIGGER trg_like_insert
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_insert();

DROP TRIGGER IF EXISTS trg_like_delete ON public.likes;
CREATE TRIGGER trg_like_delete
AFTER DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_delete();


-- 6. Add Live Streams to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;


-- 7. One-Time Synchronization Query (Fix all existing stats)
UPDATE public.profiles p
SET 
  followers_count = (SELECT COUNT(*) FROM public.follows WHERE following_id = p.id),
  following_count = (SELECT COUNT(*) FROM public.follows WHERE follower_id = p.id),
  posts_count = (SELECT COUNT(*) FROM public.posts WHERE user_id = p.id);

UPDATE public.posts pt
SET 
  likes_count = (SELECT COUNT(*) FROM public.likes WHERE target_id = pt.id AND target_type = 'post'),
  comments_count = (SELECT COUNT(*) FROM public.comments WHERE post_id = pt.id);

UPDATE public.comments c
SET 
  likes_count = (SELECT COUNT(*) FROM public.likes WHERE target_id = c.id AND target_type = 'comment');
