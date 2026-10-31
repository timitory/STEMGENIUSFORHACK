-- Create quizzes table for custom quizzes
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  topic TEXT,
  section TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  quiz_code TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT true,
  time_per_question INTEGER DEFAULT 30,
  total_questions INTEGER DEFAULT 10,
  cash_prize NUMERIC DEFAULT 0,
  gift_description TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 10,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quiz attempts table for history
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  score INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  time_taken INTEGER DEFAULT 0,
  subject TEXT NOT NULL,
  topic TEXT,
  answers JSONB,
  user_answers INTEGER[] DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create leaderboard scores table
CREATE TABLE public.leaderboard_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_score INTEGER DEFAULT 0,
  total_quizzes INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_questions_attempted INTEGER DEFAULT 0,
  math_score INTEGER DEFAULT 0,
  science_score INTEGER DEFAULT 0,
  technology_score INTEGER DEFAULT 0,
  engineering_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quizzes
CREATE POLICY "Anyone can view public quizzes" ON public.quizzes
  FOR SELECT USING (is_public = true OR auth.uid() = creator_id);

CREATE POLICY "Users can create quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own quizzes" ON public.quizzes
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own quizzes" ON public.quizzes
  FOR DELETE USING (auth.uid() = creator_id);

-- RLS Policies for quiz_questions
CREATE POLICY "Anyone can view questions of accessible quizzes" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE id = quiz_id AND (is_public = true OR creator_id = auth.uid())
    )
  );

CREATE POLICY "Quiz creators can manage questions" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND creator_id = auth.uid())
  );

CREATE POLICY "Quiz creators can update questions" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND creator_id = auth.uid())
  );

CREATE POLICY "Quiz creators can delete questions" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND creator_id = auth.uid())
  );

-- RLS Policies for quiz_attempts
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for leaderboard_scores
CREATE POLICY "Anyone can view leaderboard" ON public.leaderboard_scores
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own scores" ON public.leaderboard_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores" ON public.leaderboard_scores
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update leaderboard after quiz attempt
CREATE OR REPLACE FUNCTION public.update_leaderboard_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leaderboard_scores (user_id, total_score, total_quizzes, total_correct, total_questions_attempted)
  VALUES (NEW.user_id, NEW.score, 1, NEW.correct_answers, NEW.total_questions)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    total_score = leaderboard_scores.total_score + NEW.score,
    total_quizzes = leaderboard_scores.total_quizzes + 1,
    total_correct = leaderboard_scores.total_correct + NEW.correct_answers,
    total_questions_attempted = leaderboard_scores.total_questions_attempted + NEW.total_questions,
    updated_at = now();
  
  -- Update subject-specific scores
  IF NEW.subject = 'Mathematics' THEN
    UPDATE public.leaderboard_scores SET math_score = math_score + NEW.score WHERE user_id = NEW.user_id;
  ELSIF NEW.subject = 'Science' OR NEW.subject = 'Physics' OR NEW.subject = 'Chemistry' OR NEW.subject = 'Biology' THEN
    UPDATE public.leaderboard_scores SET science_score = science_score + NEW.score WHERE user_id = NEW.user_id;
  ELSIF NEW.subject = 'Technology' OR NEW.subject = 'Computer Science' THEN
    UPDATE public.leaderboard_scores SET technology_score = technology_score + NEW.score WHERE user_id = NEW.user_id;
  ELSIF NEW.subject = 'Engineering' THEN
    UPDATE public.leaderboard_scores SET engineering_score = engineering_score + NEW.score WHERE user_id = NEW.user_id;
  END IF;
  
  -- Update user profile progress
  UPDATE public.profiles SET
    progress = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(progress, '{"math":0,"science":0,"technology":0,"engineering":0}'::jsonb),
            '{math}',
            to_jsonb(LEAST(100, COALESCE((progress->>'math')::int, 0) + CASE WHEN NEW.subject = 'Mathematics' THEN (NEW.correct_answers * 5) ELSE 0 END))
          ),
          '{science}',
          to_jsonb(LEAST(100, COALESCE((progress->>'science')::int, 0) + CASE WHEN NEW.subject IN ('Science', 'Physics', 'Chemistry', 'Biology') THEN (NEW.correct_answers * 5) ELSE 0 END))
        ),
        '{technology}',
        to_jsonb(LEAST(100, COALESCE((progress->>'technology')::int, 0) + CASE WHEN NEW.subject IN ('Technology', 'Computer Science') THEN (NEW.correct_answers * 5) ELSE 0 END))
      ),
      '{engineering}',
      to_jsonb(LEAST(100, COALESCE((progress->>'engineering')::int, 0) + CASE WHEN NEW.subject = 'Engineering' THEN (NEW.correct_answers * 5) ELSE 0 END))
    ),
    updated_at = now()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for leaderboard updates
CREATE TRIGGER on_quiz_attempt_created
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leaderboard_score();

-- Function to update ranks
CREATE OR REPLACE FUNCTION public.update_user_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_score DESC) as new_rank
    FROM public.leaderboard_scores
  )
  UPDATE public.profiles p
  SET rank = r.new_rank
  FROM ranked r
  WHERE p.id = r.user_id;
END;
$$;