-- Create stream_signals table for reliable WebRTC signaling
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.stream_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('join', 'offer', 'answer')),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stream_signals_to_user ON public.stream_signals(to_user_id, stream_id, type);
CREATE INDEX IF NOT EXISTS idx_stream_signals_stream ON public.stream_signals(stream_id);

-- Enable RLS
ALTER TABLE public.stream_signals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users insert own signals" ON public.stream_signals
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users read signals for them" ON public.stream_signals
    FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users delete their signals" ON public.stream_signals
    FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Enable realtime on this table (critical!)
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_signals;
