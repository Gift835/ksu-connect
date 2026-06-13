-- ============================================================
-- KSU Connect: Live Streams — add updated_at column
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add updated_at column (used by heartbeat to prove stream is truly live)
ALTER TABLE public.live_streams
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Keep updated_at in sync automatically via a trigger
CREATE OR REPLACE FUNCTION public.set_live_stream_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_live_stream_updated_at ON public.live_streams;
CREATE TRIGGER trg_live_stream_updated_at
BEFORE UPDATE ON public.live_streams
FOR EACH ROW EXECUTE FUNCTION public.set_live_stream_updated_at();

-- Also update the RLS policy so the host can update viewer_count & updated_at
-- (already covered by the existing "Hosts can update own live streams" policy)

-- Backfill updated_at = created_at for existing rows
UPDATE public.live_streams
SET updated_at = created_at
WHERE updated_at IS NULL;
