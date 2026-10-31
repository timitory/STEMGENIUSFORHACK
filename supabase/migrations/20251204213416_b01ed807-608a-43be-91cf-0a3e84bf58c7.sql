-- Fix function search paths
CREATE OR REPLACE FUNCTION public.increment_followers(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_followers(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.increment_profile_likes(profile_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET likes_count = likes_count + 1 WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;