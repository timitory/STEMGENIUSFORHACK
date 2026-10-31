-- Migration: Create Past Questions & Exam Preparation Hub Tables and Seed Data
-- Module 1 of STEM Genius Expansion

-- 1. Examination Types
CREATE TABLE IF NOT EXISTS public.exam_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  has_institutions BOOLEAN DEFAULT false,
  has_levels BOOLEAN DEFAULT false,
  default_duration_minutes INTEGER DEFAULT 120,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Institutions (Universities, Polytechnics, Colleges of Medicine)
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'federal_university',
  state TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Departments / Faculties
CREATE TABLE IF NOT EXISTS public.exam_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  faculty TEXT,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Past Questions
CREATE TABLE IF NOT EXISTS public.past_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type_id UUID NOT NULL REFERENCES public.exam_types(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.exam_departments(id) ON DELETE SET NULL,
  academic_level TEXT,
  subject TEXT NOT NULL,
  topic TEXT,
  subtopic TEXT,
  year INTEGER NOT NULL,
  paper_type TEXT DEFAULT 'Paper 1',
  question_number INTEGER,
  question_format TEXT DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  diagram_url TEXT,
  explanation TEXT,
  model_answer TEXT,
  difficulty TEXT DEFAULT 'medium',
  points INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Past Question Options
CREATE TABLE IF NOT EXISTS public.past_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.past_questions(id) ON DELETE CASCADE,
  option_letter VARCHAR(2) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- 6. Practice & Timed Examination Sessions
CREATE TABLE IF NOT EXISTS public.past_question_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_mode TEXT NOT NULL DEFAULT 'practice', -- 'practice', 'timed_exam', 'topic_drill'
  exam_type_id UUID REFERENCES public.exam_types(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  year INTEGER,
  total_questions INTEGER NOT NULL DEFAULT 0,
  time_limit_seconds INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  incorrect_answers INTEGER DEFAULT 0,
  unanswered_questions INTEGER DEFAULT 0,
  accuracy_percentage NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Responses per Question in Session
CREATE TABLE IF NOT EXISTS public.past_question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.past_question_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.past_questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.past_question_options(id) ON DELETE SET NULL,
  theory_response TEXT,
  is_correct BOOLEAN,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, question_id)
);

-- 8. Question Bookmarks
CREATE TABLE IF NOT EXISTS public.past_question_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.past_questions(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, question_id)
);

-- 9. Indexes for High-Speed Filtering
CREATE INDEX IF NOT EXISTS idx_past_questions_exam_subject ON public.past_questions (exam_type_id, subject, year);
CREATE INDEX IF NOT EXISTS idx_past_questions_topic ON public.past_questions (topic);
CREATE INDEX IF NOT EXISTS idx_past_questions_institution ON public.past_questions (institution_id, academic_level);
CREATE INDEX IF NOT EXISTS idx_pq_options_question ON public.past_question_options (question_id);
CREATE INDEX IF NOT EXISTS idx_pq_sessions_user ON public.past_question_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pq_responses_session ON public.past_question_responses (session_id);
CREATE INDEX IF NOT EXISTS idx_pq_bookmarks_user ON public.past_question_bookmarks (user_id);

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_question_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_question_bookmarks ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies
-- Public Reference tables (read-only for all, write for admins)
CREATE POLICY "Anyone can view active exam types" ON public.exam_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active institutions" ON public.institutions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view departments" ON public.exam_departments
  FOR SELECT USING (true);

-- Past questions: visible to all authenticated users when published
CREATE POLICY "Users can view published past questions" ON public.past_questions
  FOR SELECT USING (is_published = true OR auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

CREATE POLICY "Admins and managers can insert past questions" ON public.past_questions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

CREATE POLICY "Admins and managers can update past questions" ON public.past_questions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

CREATE POLICY "Admins and managers can delete past questions" ON public.past_questions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

-- Options: visible when question is accessible
CREATE POLICY "Users can view options of accessible questions" ON public.past_question_options
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.past_questions WHERE id = question_id AND (is_published = true OR auth.uid() = created_by OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    ))
  ));

CREATE POLICY "Admins can manage question options" ON public.past_question_options
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

-- Sessions: User owns their practice & exam sessions
CREATE POLICY "Users can view their own sessions" ON public.past_question_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON public.past_question_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.past_question_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Responses: User can access responses for their own sessions
CREATE POLICY "Users can view their own responses" ON public.past_question_responses
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.past_question_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert responses to their own sessions" ON public.past_question_responses
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.past_question_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update responses in their own sessions" ON public.past_question_responses
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.past_question_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

-- Bookmarks: User owns bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON public.past_question_bookmarks
  FOR ALL USING (auth.uid() = user_id);

-- 12. Seed Essential Exam Types
INSERT INTO public.exam_types (code, name, description, icon, has_institutions, has_levels, default_duration_minutes, display_order)
VALUES
  ('JAMB', 'JAMB / UTME', 'Joint Admissions and Matriculation Board Unified Tertiary Matriculation Examination', 'GraduationCap', false, false, 120, 1),
  ('WAEC', 'WAEC (WASSCE)', 'West African Senior School Certificate Examination - Objective & Theory papers', 'BookOpen', false, false, 150, 2),
  ('NECO', 'NECO (SSCE)', 'National Examinations Council Senior School Certificate Examination', 'FileText', false, false, 150, 3),
  ('POST_UTME', 'Post-UTME Screening', 'Institution-specific university entry screening past questions', 'Award', true, false, 60, 4),
  ('UNIVERSITY', 'University & Tertiary Exams', 'Semester examinations across 100L to 500L departments', 'Building2', true, true, 120, 5)
ON CONFLICT (code) DO NOTHING;

-- 13. Seed Prominent Nigerian Institutions
INSERT INTO public.institutions (name, short_code, type, state)
VALUES
  ('University of Lagos', 'UNILAG', 'federal_university', 'Lagos'),
  ('University of Ibadan', 'UI', 'federal_university', 'Oyo'),
  ('Obafemi Awolowo University', 'OAU', 'federal_university', 'Osun'),
  ('University of Nigeria, Nsukka', 'UNN', 'federal_university', 'Enugu'),
  ('Ahmadu Bello University', 'ABU', 'federal_university', 'Kaduna'),
  ('Federal University of Technology, Akure', 'FUTA', 'federal_university', 'Ondo'),
  ('University of Benin', 'UNIBEN', 'federal_university', 'Edo'),
  ('Lagos State University', 'LASU', 'state_university', 'Lagos'),
  ('Covenant University', 'CU', 'private_university', 'Ogun')
ON CONFLICT (short_code) DO NOTHING;

