import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// HOOK 1: Live Quiz Lobby (Participants & Ready Status)
// ============================================
export const useLiveQuizLobby = (quizId: string | null) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [allReady, setAllReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let channel: RealtimeChannel | null = null;

  const fetchParticipants = useCallback(async () => {
    if (!quizId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('live_quiz_participants')
        .select('*')
        .eq('quiz_id', quizId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (fetchError) throw fetchError;
      setParticipants(data || []);

      // Check if all ready
      if (data && data.length > 0) {
        const ready = data.every(p => p.is_ready === true);
        setAllReady(ready);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch participants');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;

    fetchParticipants();

    // Subscribe to real-time changes
    channel = supabase
      .channel(`quiz:${quizId}:lobby`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quiz_participants',
          filter: `quiz_id=eq.${quizId}`
        },
        (payload) => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [quizId, fetchParticipants]);

  return { participants, allReady, loading, error, refetch: fetchParticipants };
};

// ============================================
// HOOK 2: Live Quiz Scores (Real-time Leaderboard)
// ============================================
export const useLiveQuizScores = (quizId: string | null) => {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let channel: RealtimeChannel | null = null;

  const fetchScores = useCallback(async () => {
    if (!quizId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('live_quiz_scores')
        .select(`
          id,
          participant_id,
          total_points,
          correct_count,
          live_quiz_participants(id, username)
        `)
        .eq('quiz_id', quizId)
        .order('total_points', { ascending: false });

      if (fetchError) throw fetchError;

      const rankedScores = (data || []).map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));

      setScores(rankedScores);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scores');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;

    fetchScores();

    // Subscribe to real-time changes
    channel = supabase
      .channel(`quiz:${quizId}:scores`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quiz_scores',
          filter: `quiz_id=eq.${quizId}`
        },
        (payload) => {
          fetchScores();
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [quizId, fetchScores]);

  return { scores, loading, error, refetch: fetchScores };
};

// ============================================
// HOOK 3: Live Quiz State (Current Question, etc)
// ============================================
export const useLiveQuizState = (quizId: string | null) => {
  const [quiz, setQuiz] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let channel: RealtimeChannel | null = null;

  useEffect(() => {
    if (!quizId) return;

    const fetchQuiz = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('live_quizzes')
          .select('*')
          .eq('id', quizId)
          .single();

        if (fetchError) throw fetchError;
        setQuiz(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();

    // Subscribe to quiz status changes
    channel = supabase
      .channel(`quiz:${quizId}:state`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quizzes',
          filter: `id=eq.${quizId}`
        },
        (payload) => {
          setQuiz(payload.new);
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [quizId]);

  return { quiz, loading, error };
};

// ============================================
// HOOK 4: Question Answers (Who answered what)
// ============================================
export const useQuestionAnswers = (
  quizId: string | null,
  questionIndex: number | null
) => {
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  let channel: RealtimeChannel | null = null;

  const fetchAnswers = useCallback(async () => {
    if (!quizId || questionIndex === null) return;

    try {
      const { data, error: fetchError } = await supabase
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

      if (fetchError) throw fetchError;
      setAnswers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch answers');
    } finally {
      setLoading(false);
    }
  }, [quizId, questionIndex]);

  useEffect(() => {
    if (!quizId || questionIndex === null) return;

    fetchAnswers();

    // Subscribe to new answers
    channel = supabase
      .channel(`quiz:${quizId}:answers:${questionIndex}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_quiz_answers',
          filter: `quiz_id=eq.${quizId}`
        },
        (payload) => {
          if (payload.new.question_index === questionIndex) {
            fetchAnswers();
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [quizId, questionIndex, fetchAnswers]);

  return { answers, loading, error, refetch: fetchAnswers };
};

// ============================================
// HOOK 5: Check if all participants answered
// ============================================
export const useAllAnswersSubmitted = (
  quizId: string | null,
  questionIndex: number | null,
  totalParticipants: number
) => {
  const [allAnswered, setAllAnswered] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quizId || questionIndex === null) return;

    const checkAnswers = async () => {
      try {
        const { count, error } = await supabase
          .from('live_quiz_answers')
          .select('*', { count: 'exact', head: true })
          .eq('quiz_id', quizId)
          .eq('question_index', questionIndex);

        if (error) throw error;

        const answered = count || 0;
        setAnsweredCount(answered);
        setAllAnswered(answered >= totalParticipants);
      } catch (err) {
        console.error('Error checking answers:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAnswers();

    // Poll every 500ms for answer updates
    const interval = setInterval(checkAnswers, 500);

    return () => clearInterval(interval);
  }, [quizId, questionIndex, totalParticipants]);

  return { allAnswered, answeredCount, loading };
};

// ============================================
// HOOK 6: Presence Channel (See who's online)
// ============================================
export const useLiveQuizPresence = (quizId: string | null) => {
  const [onlineParticipants, setOnlineParticipants] = useState<string[]>([]);
  let channel: RealtimeChannel | null = null;

  useEffect(() => {
    if (!quizId) return;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase.channel(`presence:quiz:${quizId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel?.presenceState();
          if (presenceState) {
            const ids = Object.keys(presenceState);
            setOnlineParticipants(ids);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          console.log(`${key} joined`);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`${key} left`);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel?.track({
              online_at: new Date().toISOString()
            });
          }
        });
    };

    initPresence();

    return () => {
      channel?.unsubscribe();
    };
  }, [quizId]);

  return { onlineParticipants };
};

// ============================================
// HOOK 7: Watch for Quiz Status Changes
// ============================================
export const useQuizStatusWatch = (
  quizId: string | null,
  onStatusChange: (status: string) => void
) => {
  let channel: RealtimeChannel | null = null;

  useEffect(() => {
    if (!quizId) return;

    channel = supabase
      .channel(`quiz:${quizId}:status`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_quizzes',
          filter: `id=eq.${quizId}`
        },
        (payload) => {
          const newStatus = payload.new.status;
          onStatusChange(newStatus);
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [quizId, onStatusChange]);
};
