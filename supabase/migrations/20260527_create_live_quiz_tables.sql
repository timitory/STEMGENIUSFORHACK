-- Create live_quizzes table
CREATE TABLE IF NOT EXISTS public.live_quizzes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  invite_code varchar(6) NOT NULL UNIQUE,
  max_participants integer DEFAULT 50,
  questions_count integer DEFAULT 0,
  status varchar(50) DEFAULT 'setup', -- setup, in_progress, completed
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  current_question_index integer DEFAULT 0,
  time_per_question integer DEFAULT 30, -- in seconds
  total_time integer DEFAULT 300 -- in seconds
);

-- Create live_quiz_questions table
CREATE TABLE IF NOT EXISTS public.live_quiz_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options text[] NOT NULL, -- array of 4 options
  correct_answer integer NOT NULL, -- 0-3
  points integer DEFAULT 10,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create live_quiz_participants table
CREATE TABLE IF NOT EXISTS public.live_quiz_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  is_ready boolean DEFAULT false,
  ready_at timestamp with time zone,
  final_score integer DEFAULT 0,
  rank integer,
  UNIQUE(quiz_id, user_id)
);

-- Create live_quiz_answers table
CREATE TABLE IF NOT EXISTS public.live_quiz_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.live_quiz_participants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.live_quiz_questions(id) ON DELETE CASCADE,
  selected_answer integer, -- 0-3, null if not answered
  is_correct boolean,
  points_earned integer DEFAULT 0,
  answered_at timestamp with time zone,
  time_taken integer -- in seconds
);

-- Create live_quiz_scores table
CREATE TABLE IF NOT EXISTS public.live_quiz_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.live_quiz_participants(id) ON DELETE CASCADE,
  question_index integer NOT NULL,
  correct_count integer DEFAULT 0,
  total_points integer DEFAULT 0,
  timestamp timestamp with time zone DEFAULT now(),
  UNIQUE(quiz_id, participant_id, question_index)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_live_quizzes_creator ON public.live_quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_live_quizzes_invite_code ON public.live_quizzes(invite_code);
CREATE INDEX IF NOT EXISTS idx_live_quiz_questions_quiz ON public.live_quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_participants_quiz ON public.live_quiz_participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_participants_user ON public.live_quiz_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_answers_quiz ON public.live_quiz_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_answers_participant ON public.live_quiz_answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_scores_quiz ON public.live_quiz_scores(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_scores_participant ON public.live_quiz_scores(participant_id);

-- Set up Row Level Security (RLS)
ALTER TABLE public.live_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_quiz_scores ENABLE ROW LEVEL SECURITY;

-- Policies for live_quizzes
CREATE POLICY "Users can view all quizzes" ON public.live_quizzes FOR SELECT USING (true);
CREATE POLICY "Users can create quizzes" ON public.live_quizzes FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Quiz creators can update their quizzes" ON public.live_quizzes FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Quiz creators can delete their quizzes" ON public.live_quizzes FOR DELETE USING (auth.uid() = creator_id);

-- Policies for live_quiz_questions
CREATE POLICY "Anyone can view questions" ON public.live_quiz_questions FOR SELECT USING (true);
CREATE POLICY "Quiz creators can insert questions" ON public.live_quiz_questions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);
CREATE POLICY "Quiz creators can update questions" ON public.live_quiz_questions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);
CREATE POLICY "Quiz creators can delete questions" ON public.live_quiz_questions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Policies for live_quiz_participants
CREATE POLICY "Users can view participants" ON public.live_quiz_participants FOR SELECT USING (true);
CREATE POLICY "Users can insert themselves as participants" ON public.live_quiz_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.live_quiz_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own participation" ON public.live_quiz_participants FOR DELETE USING (auth.uid() = user_id);

-- Policies for live_quiz_answers
CREATE POLICY "Users can view answers" ON public.live_quiz_answers FOR SELECT USING (true);
CREATE POLICY "Users can insert their own answers" ON public.live_quiz_answers FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));
CREATE POLICY "Users can update their own answers" ON public.live_quiz_answers FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));
CREATE POLICY "Users can delete their own answers" ON public.live_quiz_answers FOR DELETE USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));

-- Policies for live_quiz_scores
CREATE POLICY "Anyone can view scores" ON public.live_quiz_scores FOR SELECT USING (true);
CREATE POLICY "System can insert scores" ON public.live_quiz_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update scores" ON public.live_quiz_scores FOR UPDATE USING (true);
