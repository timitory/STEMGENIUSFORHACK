-- Live Quiz System - Database Migration
-- Run this in Supabase SQL Editor

-- Drop existing tables if needed (WARNING: Data loss!)
-- DROP TABLE IF EXISTS live_quiz_scores CASCADE;
-- DROP TABLE IF EXISTS live_quiz_answers CASCADE;
-- DROP TABLE IF EXISTS live_quiz_participants CASCADE;
-- DROP TABLE IF EXISTS live_quiz_questions CASCADE;
-- DROP TABLE IF EXISTS live_quizzes CASCADE;

-- ============================================
-- TABLE 1: Live Quizzes (Main Quiz Record)
-- ============================================
CREATE TABLE IF NOT EXISTS live_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'setup',
  current_question_index INT DEFAULT 0,
  max_participants INT DEFAULT 50,
  questions_count INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  settings JSONB DEFAULT '{"show_results_delay": 3, "answer_timeout": 30}'
);

-- ============================================
-- TABLE 2: Quiz Participants
-- ============================================
CREATE TABLE IF NOT EXISTS live_quiz_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES live_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  is_ready BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT now(),
  left_at TIMESTAMP,
  UNIQUE(quiz_id, user_id)
);

-- ============================================
-- TABLE 3: Quiz Questions
-- ============================================
CREATE TABLE IF NOT EXISTS live_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES live_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INT NOT NULL,
  points INT DEFAULT 10,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(quiz_id, order_index)
);

-- ============================================
-- TABLE 4: Submitted Answers
-- ============================================
CREATE TABLE IF NOT EXISTS live_quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES live_quizzes(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES live_quiz_participants(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  selected_answer INT,
  is_correct BOOLEAN,
  answer_time_ms INT,
  points_earned INT DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- TABLE 5: Real-time Scores
-- ============================================
CREATE TABLE IF NOT EXISTS live_quiz_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES live_quizzes(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES live_quiz_participants(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  rank INT,
  last_updated TIMESTAMP DEFAULT now(),
  UNIQUE(quiz_id, participant_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_live_quizzes_status ON live_quizzes(status);
CREATE INDEX IF NOT EXISTS idx_live_quizzes_invite_code ON live_quizzes(invite_code);
CREATE INDEX IF NOT EXISTS idx_live_quizzes_creator ON live_quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_live_quizzes_created ON live_quizzes(created_at);
CREATE INDEX IF NOT EXISTS idx_participants_quiz ON live_quiz_participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON live_quiz_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_joined ON live_quiz_participants(joined_at);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON live_quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_quiz ON live_quiz_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_participant ON live_quiz_answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON live_quiz_answers(question_index);
CREATE INDEX IF NOT EXISTS idx_scores_quiz ON live_quiz_scores(quiz_id);
CREATE INDEX IF NOT EXISTS idx_scores_participant ON live_quiz_scores(participant_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE live_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_quiz_scores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- LIVE_QUIZZES Policies
DROP POLICY IF EXISTS "Users can create live quizzes" ON live_quizzes;
CREATE POLICY "Users can create live quizzes" 
  ON live_quizzes FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can view relevant quizzes" ON live_quizzes;
CREATE POLICY "Users can view relevant quizzes" 
  ON live_quizzes FOR SELECT 
  USING (
    auth.uid() = creator_id OR
    id IN (
      SELECT quiz_id FROM live_quiz_participants 
      WHERE user_id = auth.uid()
    ) OR
    status = 'finished' -- Anyone can see finished quizzes
  );

DROP POLICY IF EXISTS "Creators can update their quizzes" ON live_quizzes;
CREATE POLICY "Creators can update their quizzes" 
  ON live_quizzes FOR UPDATE 
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- LIVE_QUIZ_PARTICIPANTS Policies
DROP POLICY IF EXISTS "Users can join quizzes" ON live_quiz_participants;
CREATE POLICY "Users can join quizzes" 
  ON live_quiz_participants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view participants" ON live_quiz_participants;
CREATE POLICY "Users can view participants" 
  ON live_quiz_participants FOR SELECT 
  USING (
    quiz_id IN (
      SELECT id FROM live_quizzes WHERE creator_id = auth.uid() OR
        id IN (SELECT quiz_id FROM live_quiz_participants WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can update their status" ON live_quiz_participants;
CREATE POLICY "Participants can update their status" 
  ON live_quiz_participants FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- LIVE_QUIZ_QUESTIONS Policies
DROP POLICY IF EXISTS "Users can view quiz questions" ON live_quiz_questions;
CREATE POLICY "Users can view quiz questions" 
  ON live_quiz_questions FOR SELECT 
  USING (
    quiz_id IN (
      SELECT id FROM live_quizzes WHERE creator_id = auth.uid() OR
        id IN (SELECT quiz_id FROM live_quiz_participants WHERE user_id = auth.uid())
    )
  );

-- LIVE_QUIZ_ANSWERS Policies
DROP POLICY IF EXISTS "Users can submit their own answers" ON live_quiz_answers;
CREATE POLICY "Users can submit their own answers" 
  ON live_quiz_answers FOR INSERT 
  WITH CHECK (
    participant_id IN (
      SELECT id FROM live_quiz_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view answers in their quiz" ON live_quiz_answers;
CREATE POLICY "Users can view answers in their quiz" 
  ON live_quiz_answers FOR SELECT 
  USING (
    quiz_id IN (
      SELECT id FROM live_quizzes WHERE creator_id = auth.uid() OR
        id IN (SELECT quiz_id FROM live_quiz_participants WHERE user_id = auth.uid())
    )
  );

-- LIVE_QUIZ_SCORES Policies
DROP POLICY IF EXISTS "Users can view scores" ON live_quiz_scores;
CREATE POLICY "Users can view scores" 
  ON live_quiz_scores FOR SELECT 
  USING (
    quiz_id IN (
      SELECT id FROM live_quizzes WHERE creator_id = auth.uid() OR
        id IN (SELECT quiz_id FROM live_quiz_participants WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "System can update scores" ON live_quiz_scores;
CREATE POLICY "System can update scores" 
  ON live_quiz_scores FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update participant score after answer
CREATE OR REPLACE FUNCTION update_participant_score(
  p_participant_id UUID,
  p_quiz_id UUID,
  p_points INT
)
RETURNS void AS $$
BEGIN
  UPDATE live_quiz_scores
  SET total_points = total_points + p_points,
      correct_count = correct_count + CASE WHEN p_points > 0 THEN 1 ELSE 0 END,
      last_updated = now()
  WHERE participant_id = p_participant_id
    AND quiz_id = p_quiz_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate rankings
CREATE OR REPLACE FUNCTION calculate_rankings(p_quiz_id UUID)
RETURNS void AS $$
BEGIN
  WITH ranked_scores AS (
    SELECT id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, correct_count DESC) as new_rank
    FROM live_quiz_scores
    WHERE quiz_id = p_quiz_id
  )
  UPDATE live_quiz_scores
  SET rank = ranked_scores.new_rank
  FROM ranked_scores
  WHERE live_quiz_scores.id = ranked_scores.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to add test data

/*
INSERT INTO live_quizzes (creator_id, title, description, invite_code, questions_count)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Sample Live Quiz',
  'A test quiz for demonstration',
  'DEMO123',
  1
);

INSERT INTO live_quiz_questions (
  quiz_id, question_text, options, correct_answer, points, order_index
)
VALUES (
  (SELECT id FROM live_quizzes LIMIT 1),
  'What is 2 + 2?',
  '["3", "4", "5", "6"]',
  1,
  10,
  0
);
*/

-- Verification queries
SELECT 'Tables created:' as status;
SELECT count(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'live_quiz%';

SELECT 'RLS enabled on all tables' as status;

SELECT 'Migration complete!' as status;
