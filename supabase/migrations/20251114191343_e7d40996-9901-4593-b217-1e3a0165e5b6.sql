-- Create reels table for short-form videos
CREATE TABLE public.reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create reel_likes table
CREATE TABLE public.reel_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(reel_id, user_id)
);

-- Create reel_comments table
CREATE TABLE public.reel_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create live_sessions table for marketplace live streaming
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  viewers_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  room_id TEXT UNIQUE NOT NULL
);

-- Create live_participants table
CREATE TABLE public.live_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, user_id)
);

-- Create pdf_conversions table
CREATE TABLE public.pdf_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_url TEXT NOT NULL,
  audio_url TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'processing',
  conversion_type TEXT NOT NULL, -- 'audio' or 'video'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_conversions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reels
CREATE POLICY "Anyone can view public reels"
  ON public.reels FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own reels"
  ON public.reels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels"
  ON public.reels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels"
  ON public.reels FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for reel_likes
CREATE POLICY "Anyone can view likes"
  ON public.reel_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like reels"
  ON public.reel_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike reels"
  ON public.reel_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for reel_comments
CREATE POLICY "Anyone can view comments"
  ON public.reel_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON public.reel_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.reel_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.reel_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for live_sessions
CREATE POLICY "Anyone can view active live sessions"
  ON public.live_sessions FOR SELECT
  USING (is_active = true OR auth.uid() = host_id);

CREATE POLICY "Users can create live sessions"
  ON public.live_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their sessions"
  ON public.live_sessions FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their sessions"
  ON public.live_sessions FOR DELETE
  USING (auth.uid() = host_id);

-- RLS Policies for live_participants
CREATE POLICY "Anyone can view participants"
  ON public.live_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join sessions"
  ON public.live_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions"
  ON public.live_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for pdf_conversions
CREATE POLICY "Users can view their own conversions"
  ON public.pdf_conversions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversions"
  ON public.pdf_conversions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('reels', 'reels', true),
  ('reel-thumbnails', 'reel-thumbnails', true),
  ('live-recordings', 'live-recordings', true),
  ('pdf-conversions', 'pdf-conversions', true);

-- Storage policies for reels bucket
CREATE POLICY "Anyone can view reel videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reels');

CREATE POLICY "Authenticated users can upload reel videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own reel videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own reel videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for reel-thumbnails bucket
CREATE POLICY "Anyone can view reel thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reel-thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reel-thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own thumbnails"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'reel-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own thumbnails"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reel-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for pdf-conversions bucket
CREATE POLICY "Users can view their own conversions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdf-conversions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can upload conversions"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pdf-conversions' AND auth.role() = 'authenticated');

-- Functions to increment counters
CREATE OR REPLACE FUNCTION public.increment_reel_views(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET views_count = views_count + 1
  WHERE id = reel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_reel_likes(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET likes_count = likes_count + 1
  WHERE id = reel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_reel_likes(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET likes_count = likes_count - 1
  WHERE id = reel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_reel_comments(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET comments_count = comments_count + 1
  WHERE id = reel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_reel_shares(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET shares_count = shares_count + 1
  WHERE id = reel_id;
END;
$$;