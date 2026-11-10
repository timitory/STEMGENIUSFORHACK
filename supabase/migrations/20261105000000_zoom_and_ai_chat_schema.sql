-- Migration: Zoom Integration & Gemini AI Conversational Chat
-- Timestamp: 20261105000000

-- ============================================================================
-- 1. EXTEND VIRTUAL CLASSES FOR ZOOM MEETING & WEBINAR INTEGRATION
-- ============================================================================

DO $$ 
BEGIN
  -- Add Zoom meeting columns to virtual_classes if they do not exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_meeting_id') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_meeting_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_numeric_id') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_numeric_id BIGINT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_uuid') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_uuid TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_join_url') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_join_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_start_url') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_start_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_passcode') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_passcode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_host_id') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_host_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_recording_status') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_recording_status TEXT DEFAULT 'not_started';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'virtual_classes' AND column_name = 'zoom_metadata') THEN
    ALTER TABLE public.virtual_classes ADD COLUMN zoom_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Extend class_recordings for Zoom Cloud Recordings
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_recordings' AND column_name = 'zoom_recording_id') THEN
    ALTER TABLE public.class_recordings ADD COLUMN zoom_recording_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_recordings' AND column_name = 'zoom_play_url') THEN
    ALTER TABLE public.class_recordings ADD COLUMN zoom_play_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_recordings' AND column_name = 'zoom_download_url') THEN
    ALTER TABLE public.class_recordings ADD COLUMN zoom_download_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_recordings' AND column_name = 'zoom_recording_files') THEN
    ALTER TABLE public.class_recordings ADD COLUMN zoom_recording_files JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_recordings' AND column_name = 'zoom_share_url') THEN
    ALTER TABLE public.class_recordings ADD COLUMN zoom_share_url TEXT;
  END IF;
END $$;

-- Indexes for Zoom Lookups
CREATE INDEX IF NOT EXISTS idx_virtual_classes_zoom_id ON public.virtual_classes (zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_virtual_classes_zoom_num ON public.virtual_classes (zoom_numeric_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_zoom_id ON public.class_recordings (zoom_recording_id);

-- ============================================================================
-- 2. GEMINI AI PERSISTENT CONVERSATIONAL CHAT TABLES
-- ============================================================================

-- Table: ai_conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  conversation_summary TEXT
);

-- Table: ai_messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast chronological conversation retrieval
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created ON public.ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON public.ai_messages (user_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) FOR AI CONVERSATIONS & MESSAGES
-- ============================================================================

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- ai_conversations policies
CREATE POLICY "Users can view their own conversations" 
  ON public.ai_conversations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
  ON public.ai_conversations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
  ON public.ai_conversations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
  ON public.ai_conversations FOR DELETE 
  USING (auth.uid() = user_id);

-- ai_messages policies
CREATE POLICY "Users can view messages in their own conversations" 
  ON public.ai_messages FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages into their own conversations" 
  ON public.ai_messages FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update messages in their own conversations" 
  ON public.ai_messages FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete messages in their own conversations" 
  ON public.ai_messages FOR DELETE 
  USING (auth.uid() = user_id);

