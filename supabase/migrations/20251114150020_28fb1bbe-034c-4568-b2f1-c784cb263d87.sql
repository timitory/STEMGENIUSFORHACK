-- Create homework_sessions table to store all homework help interactions
CREATE TABLE public.homework_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT,
  question_image_url TEXT,
  response_text TEXT NOT NULL,
  response_audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.homework_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own homework sessions" 
ON public.homework_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own homework sessions" 
ON public.homework_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own homework sessions" 
ON public.homework_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_homework_sessions_user_id ON public.homework_sessions(user_id);
CREATE INDEX idx_homework_sessions_created_at ON public.homework_sessions(created_at DESC);

-- Create storage bucket for homework images
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-images', 'homework-images', true);

-- Storage policies for homework images
CREATE POLICY "Users can upload their own homework images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'homework-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own homework images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'homework-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Homework images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'homework-images');