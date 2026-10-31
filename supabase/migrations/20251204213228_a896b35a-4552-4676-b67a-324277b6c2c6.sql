-- Create follows table for user relationships
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Create profile_likes table
CREATE TABLE public.profile_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  liker_id UUID NOT NULL,
  liked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(liker_id, liked_id)
);

-- Enable RLS
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view profile likes" ON public.profile_likes FOR SELECT USING (true);
CREATE POLICY "Users can like profiles" ON public.profile_likes FOR INSERT WITH CHECK (auth.uid() = liker_id);
CREATE POLICY "Users can unlike profiles" ON public.profile_likes FOR DELETE USING (auth.uid() = liker_id);

-- Add scheduled live sessions support
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false;

-- Add speakers table for multi-speaker support
CREATE TABLE public.live_speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.live_speakers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view speakers" ON public.live_speakers FOR SELECT USING (true);
CREATE POLICY "Users can request to speak" ON public.live_speakers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Session hosts can update speakers" ON public.live_speakers FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.live_sessions WHERE id = live_speakers.session_id AND host_id = auth.uid()));
CREATE POLICY "Hosts can remove speakers" ON public.live_speakers FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.live_sessions WHERE id = live_speakers.session_id AND host_id = auth.uid()) OR auth.uid() = user_id);

-- Add followers/following count to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Functions to increment/decrement counts
CREATE OR REPLACE FUNCTION public.increment_followers(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_followers(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_profile_likes(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET likes_count = likes_count + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;