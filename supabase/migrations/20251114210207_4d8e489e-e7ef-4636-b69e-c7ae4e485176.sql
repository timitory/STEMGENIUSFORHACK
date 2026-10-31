-- Add comment_likes table for liking comments
CREATE TABLE IF NOT EXISTS public.reel_comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comment likes"
  ON public.reel_comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like comments"
  ON public.reel_comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own comment likes"
  ON public.reel_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Add parent_id to reel_comments for replies (subcomments)
ALTER TABLE public.reel_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.reel_comments(id) ON DELETE CASCADE;

-- Add likes_count to reel_comments
ALTER TABLE public.reel_comments 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Function to increment comment likes
CREATE OR REPLACE FUNCTION public.increment_comment_likes(comment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reel_comments
  SET likes_count = likes_count + 1
  WHERE id = comment_id;
END;
$$;

-- Function to decrement comment likes
CREATE OR REPLACE FUNCTION public.decrement_comment_likes(comment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reel_comments
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = comment_id;
END;
$$;