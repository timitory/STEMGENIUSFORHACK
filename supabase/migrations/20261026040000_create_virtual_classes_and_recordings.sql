-- Migration: Create Large-Scale Virtual Classes, Meetings, and Recordings Tables
-- Module 3 of STEM Genius Expansion

-- 1. Virtual Classes / Large-Scale Meetings Table
CREATE TABLE IF NOT EXISTS public.virtual_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  co_host_ids UUID[] DEFAULT '{}',
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  topic TEXT,
  exam_type_id UUID REFERENCES public.exam_types(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  max_capacity INTEGER DEFAULT 1000,
  access_type TEXT DEFAULT 'public', -- 'public', 'registered_only', 'private'
  is_waiting_room_enabled BOOLEAN DEFAULT false,
  meeting_format TEXT DEFAULT 'webinar', -- 'webinar' (1000+ scale SFU/broadcast), 'interactive_meeting'
  is_recording_enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'live', 'ended', 'cancelled'
  actual_started_at TIMESTAMPTZ,
  actual_ended_at TIMESTAMPTZ,
  peak_participants INTEGER DEFAULT 0,
  banner_image_url TEXT,
  presentation_slides_url TEXT,
  host_announcements TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Class Registrations & Attendance Table
CREATE TABLE IF NOT EXISTS public.class_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.virtual_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT now(),
  attendance_status TEXT DEFAULT 'registered', -- 'registered', 'attended', 'absent'
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  minutes_attended INTEGER DEFAULT 0,
  UNIQUE (class_id, user_id)
);

-- 3. Class Recordings Metadata Table
CREATE TABLE IF NOT EXISTS public.class_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.virtual_classes(id) ON DELETE CASCADE,
  recording_title TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  status TEXT DEFAULT 'processing', -- 'pending', 'processing', 'ready', 'failed'
  access_permission TEXT DEFAULT 'registered_attendees', -- 'public', 'registered_attendees', 'host_only'
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ
);

-- 4. Class Q&A Questions Table
CREATE TABLE IF NOT EXISTS public.class_qa_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.virtual_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  upvotes_count INTEGER DEFAULT 0,
  is_answered BOOLEAN DEFAULT false,
  answer_text TEXT,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Class Hand Raises Queue Table
CREATE TABLE IF NOT EXISTS public.class_hand_raises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.virtual_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, user_id)
);

-- 6. Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_virtual_classes_status ON public.virtual_classes (status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_virtual_classes_subject ON public.virtual_classes (subject);
CREATE INDEX IF NOT EXISTS idx_class_regs_user ON public.class_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_class ON public.class_recordings (class_id, status);
CREATE INDEX IF NOT EXISTS idx_class_qa_class ON public.class_qa_items (class_id, upvotes_count DESC);

-- 7. Enable RLS
ALTER TABLE public.virtual_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_qa_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_hand_raises ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
-- Virtual Classes: Active or scheduled classes visible to anyone; host/admins can manage
CREATE POLICY "Anyone can view scheduled and live classes" ON public.virtual_classes
  FOR SELECT USING (
    status != 'cancelled' OR
    auth.uid() = host_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Authorized tutors and hosts can create classes" ON public.virtual_classes
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator', 'tutor')) OR
      EXISTS (SELECT 1 FROM public.tutor_profiles WHERE user_id = auth.uid() AND verification_status = 'verified')
    )
  );

CREATE POLICY "Hosts and admins can update classes" ON public.virtual_classes
  FOR UPDATE USING (
    auth.uid() = host_id OR
    auth.uid() = ANY(co_host_ids) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Registrations: User can register and see their own registrations; host can see all
CREATE POLICY "Users can view registrations" ON public.class_registrations
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Users can register for classes" ON public.class_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance" ON public.class_registrations
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid())
  );

-- Recordings: Accessible according to permission
CREATE POLICY "Users can view accessible recordings" ON public.class_recordings
  FOR SELECT USING (
    status = 'ready' AND (
      access_permission = 'public' OR
      EXISTS (SELECT 1 FROM public.class_registrations WHERE class_id = class_recordings.class_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_recordings.class_id AND host_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
    )
  );

CREATE POLICY "Hosts can insert recordings" ON public.class_recordings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Hosts can update recordings" ON public.class_recordings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Q&A Items: Visible to all participants; users can insert
CREATE POLICY "Anyone in class can view Q&A" ON public.class_qa_items
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit questions" ON public.class_qa_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts and authors can update Q&A" ON public.class_qa_items
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Hand raises
CREATE POLICY "Anyone in class can view hand raises" ON public.class_hand_raises
  FOR SELECT USING (true);

CREATE POLICY "Users can raise their hand" ON public.class_hand_raises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can manage hand raises" ON public.class_hand_raises
  FOR ALL USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.virtual_classes WHERE id = class_id AND host_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

