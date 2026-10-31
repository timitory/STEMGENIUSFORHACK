-- Create voice_tutor_sessions table for Voice STEM Tutor
CREATE TABLE public.voice_tutor_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  voice TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_tutor_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own voice tutor sessions"
ON public.voice_tutor_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice tutor sessions"
ON public.voice_tutor_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice tutor sessions"
ON public.voice_tutor_sessions FOR DELETE
USING (auth.uid() = user_id);