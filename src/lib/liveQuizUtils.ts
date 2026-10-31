import { supabase } from '@/integrations/supabase/client';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique 6-character invite code
 */
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Create a new live quiz
 */
export const createLiveQuiz = async (
  title: string,
  description: string,
  questions: Array<{
    text: string;
    options: string[];
    correctAnswer: number;
    points: number;
  }>,
  maxParticipants: number = 50,
  isTimed: boolean = true,
  totalTime: number = 300
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inviteCode = generateInviteCode();

  const { data: quiz, error: quizError } = await supabase
    .from('live_quizzes')
    .insert({
      creator_id: user.id,
      title,
      description,
      invite_code: inviteCode,
      max_participants: maxParticipants,
      questions_count: questions.length,
      status: 'setup',
      time_per_question: null,
      total_time: isTimed ? totalTime : null
    })
    .select()
    .single();

  if (quizError) throw quizError;
  if (!quiz) throw new Error('Failed to create quiz');

  // Insert questions
  const questionsData = questions.map((q, idx) => ({
    quiz_id: quiz.id,
    question_text: q.text,
    options: q.options,
    correct_answer: q.correctAnswer,
    points: q.points,
    order_index: idx
  }));

  const { error: questionsError } = await supabase
    .from('live_quiz_questions')
    .insert(questionsData);

  if (questionsError) throw questionsError;

  // Add creator as a participant (host/ready by default)
  const creatorUsername = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Host';
  const { data: participant, error: participantError } = await supabase
    .from('live_quiz_participants')
    .insert({
      quiz_id: quiz.id,
      user_id: user.id,
      username: creatorUsername,
      is_ready: true,
      ready_at: new Date().toISOString()
    })
    .select()
    .single();

  if (participantError) throw participantError;

  // Create score record for creator
  const { error: scoreError } = await supabase
    .from('live_quiz_scores')
    .insert({
      quiz_id: quiz.id,
      participant_id: participant.id,
      question_index: 0,
      total_points: 0,
      correct_count: 0
    });

  if (scoreError) throw scoreError;

  return quiz;
};

/**
 * Join a live quiz using invite code
 */
export const joinLiveQuiz = async (
  inviteCode: string,
  username: string
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Find quiz by code (case-insensitive)
  const { data: quiz, error: quizError } = await supabase
    .from('live_quizzes')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (quizError || !quiz) throw new Error('Quiz not found');

  // Check if participant limit reached
  const { count, error: countError } = await supabase
    .from('live_quiz_participants')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quiz.id)
    .is('left_at', null);

  if (countError) throw countError;
  if (count && count >= quiz.max_participants) {
    throw new Error('Quiz is full');
  }

  // Add participant
  const { data: participant, error: participantError } = await supabase
    .from('live_quiz_participants')
    .insert({
      quiz_id: quiz.id,
      user_id: user.id,
      username
    })
    .select()
    .single();

  if (participantError) throw participantError;
  if (!participant) throw new Error('Failed to join quiz');

  // Create score record (for initial tracking, question_index starts at 0)
  const { error: scoreError } = await supabase
    .from('live_quiz_scores')
    .insert({
      quiz_id: quiz.id,
      participant_id: participant.id,
      question_index: 0,
      total_points: 0,
      correct_count: 0
    });

  if (scoreError) throw scoreError;

  return { quiz, participant };
};

/**
 * Update participant ready status
 */
export const updateReadyStatus = async (
  participantId: string,
  isReady: boolean
) => {
  const { error } = await supabase
    .from('live_quiz_participants')
    .update({ is_ready: isReady })
    .eq('id', participantId);

  if (error) throw error;
};

/**
 * Get all participants in a quiz
 */
export const getParticipants = async (quizId: string) => {
  const { data, error } = await supabase
    .from('live_quiz_participants')
    .select('*')
    .eq('quiz_id', quizId)
    .is('left_at', null)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Check if all participants are ready
 */
export const areAllReady = async (quizId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('live_quiz_participants')
    .select('is_ready')
    .eq('quiz_id', quizId)
    .is('left_at', null);

  if (error) throw error;
  if (!data || data.length === 0) return false;

  return data.every(p => p.is_ready === true);
};

/**
 * Start a live quiz (creator only)
 */
export const startLiveQuiz = async (quizId: string) => {
  const { error } = await supabase
    .from('live_quizzes')
    .update({
      status: 'playing',
      started_at: new Date().toISOString(),
      current_question_index: 0
    })
    .eq('id', quizId);

  if (error) throw error;
};

/**
 * Get current question
 */
export const getCurrentQuestion = async (
  quizId: string,
  questionIndex: number
) => {
  const { data, error } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('order_index', questionIndex)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get all questions in a quiz
 */
export const getQuizQuestions = async (quizId: string) => {
  const { data, error } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Submit an answer
 */
export const submitAnswer = async (
  quizId: string,
  participantId: string,
  questionIndex: number,
  selectedAnswer: number,
  answerTimeMs: number
) => {
  // Get the question to verify correct answer
  const { data: question, error: qError } = await supabase
    .from('live_quiz_questions')
    .select('correct_answer, points')
    .eq('quiz_id', quizId)
    .eq('order_index', questionIndex)
    .single();

  if (qError) throw qError;
  if (!question) throw new Error('Question not found');

  const isCorrect = selectedAnswer === question.correct_answer;
  const pointsEarned = isCorrect ? question.points : 0;

  // Insert answer
  const { data: answer, error: aError } = await supabase
    .from('live_quiz_answers')
    .insert({
      quiz_id: quizId,
      participant_id: participantId,
      question_index: questionIndex,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      answer_time_ms: answerTimeMs,
      points_earned: pointsEarned
    })
    .select()
    .single();

  if (aError) throw aError;

  // Update score
  try {
    await supabase.rpc('update_participant_score', {
      p_participant_id: participantId,
      p_quiz_id: quizId,
      p_points: pointsEarned
    });
  } catch (e) {
    console.error('Score update error:', e);
  }

  return { isCorrect, pointsEarned };
};

/**
 * Get all answers submitted for a specific question
 */
export const getQuestionAnswers = async (
  quizId: string,
  questionIndex: number
) => {
  const { data, error } = await supabase
    .from('live_quiz_answers')
    .select(`
      id,
      participant_id,
      selected_answer,
      is_correct,
      answer_time_ms,
      points_earned,
      live_quiz_participants(id, username)
    `)
    .eq('quiz_id', quizId)
    .eq('question_index', questionIndex);

  if (error) throw error;
  return data || [];
};

/**
 * Get current leaderboard scores
 */
export const getLeaderboard = async (quizId: string) => {
  const { data, error } = await supabase
    .from('live_quiz_scores')
    .select(`
      id,
      participant_id,
      total_points,
      correct_count,
      rank,
      live_quiz_participants(id, username)
    `)
    .eq('quiz_id', quizId)
    .order('total_points', { ascending: false })
    .order('correct_count', { ascending: false });

  if (error) throw error;

  return (data || []).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
};

/**
 * Get quiz by ID
 */
export const getQuiz = async (quizId: string) => {
  const { data, error } = await supabase
    .from('live_quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get quiz by invite code
 */
export const getQuizByCode = async (inviteCode: string) => {
  const { data, error } = await supabase
    .from('live_quizzes')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error) throw error;
  return data;
};

/**
 * Advance to next question
 */
export const advanceToNextQuestion = async (
  quizId: string,
  nextQuestionIndex: number
) => {
  const { error } = await supabase
    .from('live_quizzes')
    .update({
      current_question_index: nextQuestionIndex
    })
    .eq('id', quizId);

  if (error) throw error;
};

/**
 * Finish quiz
 */
export const finishQuiz = async (quizId: string) => {
  const { error } = await supabase
    .from('live_quizzes')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString()
    })
    .eq('id', quizId);

  if (error) throw error;

  // Calculate final rankings
  try {
    await supabase.rpc('calculate_rankings', {
      p_quiz_id: quizId
    });
  } catch (e) {
    console.error('Ranking calculation error:', e);
  }
};

/**
 * Leave quiz (mark participant as left)
 */
export const leaveQuiz = async (participantId: string) => {
  const { error } = await supabase
    .from('live_quiz_participants')
    .update({
      left_at: new Date().toISOString()
    })
    .eq('id', participantId);

  if (error) throw error;
};

/**
 * Check if participant has already answered a question
 */
export const hasParticipantAnswered = async (
  participantId: string,
  questionIndex: number
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('live_quiz_answers')
    .select('id')
    .eq('participant_id', participantId)
    .eq('question_index', questionIndex)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // 'not found' is expected
  return !!data;
};

/**
 * Get count of participants who answered current question
 */
export const getAnsweredCount = async (
  quizId: string,
  questionIndex: number
): Promise<number> => {
  const { count, error } = await supabase
    .from('live_quiz_answers')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .eq('question_index', questionIndex);

  if (error) throw error;
  return count || 0;
};

/**
 * Get total active participants count
 */
export const getActiveParticipantsCount = async (
  quizId: string
): Promise<number> => {
  const { count, error } = await supabase
    .from('live_quiz_participants')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .is('left_at', null);

  if (error) throw error;
  return count || 0;
};
