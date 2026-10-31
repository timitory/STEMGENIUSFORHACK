-- Add timing columns to quizzes table
-- Allows quizzes to have timed or untimed modes with customizable time limits

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_timed boolean DEFAULT true;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS time_per_question integer DEFAULT 30;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS total_time integer DEFAULT 300;

-- Add helpful comment explaining the columns
COMMENT ON COLUMN public.quizzes.is_timed IS 'Whether this quiz has time limits (true) or is untimed (false)';
COMMENT ON COLUMN public.quizzes.time_per_question IS 'Seconds allocated per question (nullable if untimed)';
COMMENT ON COLUMN public.quizzes.total_time IS 'Total seconds for entire quiz (nullable if untimed)';
