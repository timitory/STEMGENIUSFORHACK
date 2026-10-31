import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, Send } from 'lucide-react';
import { useLiveQuizScores, useLiveQuizState, useAllAnswersSubmitted } from '@/hooks/useLiveQuiz';
import * as liveQuizUtils from '@/lib/liveQuizUtils';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  points: number;
  order_index: number;
}

interface Score {
  rank: number;
  live_quiz_participants: { username: string };
  total_points: number;
  participant_id: string;
}

export const LiveQuizPlayer: React.FC = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(0);

  const { quiz, loading: stateLoading } = useLiveQuizState(quizId || null);
  const { scores, loading: scoresLoading } = useLiveQuizScores(quizId || null);
  const { allAnswered } = useAllAnswersSubmitted(
    quizId,
    quiz?.current_question_index,
    scores.length
  );

  // Initialize participant and load question
  useEffect(() => {
    const initializePlayer = async () => {
      if (!quizId) {
        setError('No quiz ID provided');
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth/login');
          return;
        }

        // Get participants to find current user's ID
        const participants = await liveQuizUtils.getParticipants(quizId);
        const currentParticipant = participants.find(p => p.user_id === user.id);

        if (!currentParticipant) {
          setError('You are not a participant in this quiz');
          setLoading(false);
          return;
        }

        setParticipantId(currentParticipant.id);

        // Get current question
        const currentQuizState = await liveQuizUtils.getQuiz(quizId);
        if (currentQuizState) {
          const q = await liveQuizUtils.getCurrentQuestion(quizId, currentQuizState.current_question_index);
          if (q) {
            setQuestion(q);
            setTimeLeft(30); // 30 second per question
            setStartTime(Date.now());
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initializePlayer();
  }, [quizId, navigate]);

  // Timer effect
  useEffect(() => {
    if (!question || submitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-submit when time runs out
          if (selectedAnswer !== null && !submitted) {
            handleSubmitAnswer();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [question, submitted, selectedAnswer]);

  // Handle answer submission
  const handleSubmitAnswer = async () => {
    if (!participantId || !quizId || !question || selectedAnswer === null) {
      setError('Cannot submit - missing information');
      return;
    }

    try {
      setSubmitted(true);
      const answerTimeMs = Date.now() - startTime;

      await liveQuizUtils.submitAnswer(
        quizId,
        participantId,
        question.order_index,
        selectedAnswer,
        answerTimeMs
      );

      // Wait a bit for scores to update, then check if all answered
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
      setSubmitted(false);
    }
  };

  // Handle answer selection
  const handleSelectAnswer = (answerIndex: number) => {
    if (!submitted) {
      setSelectedAnswer(answerIndex);
    }
  };

  if (loading || stateLoading || scoresLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!question || !quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 max-w-md w-full shadow-lg">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Question not found</p>
          <Button onClick={() => navigate('/live-quiz')} className="w-full">
            Back to Quizzes
          </Button>
        </Card>
      </div>
    );
  }

  const topScores = scores.slice(0, 5);
  const userScore = scores.find(s => s.participant_id === participantId);
  const isAnswered = submitted || allAnswered;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Question Area */}
        <div className="lg:col-span-2">
          {/* Question Card */}
          <Card className="mb-6 p-8 shadow-lg bg-white">
            {/* Question Number */}
            <div className="text-sm font-semibold text-indigo-600 uppercase mb-2">
              Question {(quiz.current_question_index || 0) + 1} of {quiz.questions_count}
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 mb-6">
              <Clock className={`h-6 w-6 ${timeLeft <= 10 ? 'text-red-500' : 'text-indigo-600'}`} />
              <div className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-indigo-600'}`}>
                {timeLeft}s
              </div>
              <div className="ml-auto">
                {submitted ? (
                  <span className="text-green-600 font-semibold">✓ Submitted</span>
                ) : allAnswered ? (
                  <span className="text-orange-600 font-semibold">Waiting for others...</span>
                ) : (
                  <span className="text-blue-600 font-semibold">Select an answer</span>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-indigo-600'}`}
                style={{ width: `${(timeLeft / 30) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <h2 className="text-2xl font-bold text-gray-900 mb-8">{question.question_text}</h2>

            {/* Answer Options */}
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={submitted}
                  className={`w-full p-4 rounded-lg border-2 text-left font-medium transition-all ${
                    selectedAnswer === index
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                  } ${submitted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold ${
                        selectedAnswer === index
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedAnswer === index && '✓'}
                    </div>
                    {option}
                  </div>
                </button>
              ))}
            </div>

            {/* Submit Button */}
            {!submitted && !allAnswered && (
              <Button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="w-full mt-8 py-4 text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="h-5 w-5" />
                Submit Answer
              </Button>
            )}

            {submitted && (
              <div className="mt-8 p-4 bg-green-50 border border-green-300 rounded-lg text-center">
                <p className="text-green-700 font-semibold">✓ Answer submitted!</p>
                {allAnswered ? (
                  <p className="text-green-600 text-sm mt-1">All participants answered. Moving to results...</p>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">Waiting for others to answer...</p>
                )}
              </div>
            )}
          </Card>

          {error && (
            <Card className="p-4 bg-red-50 border border-red-200">
              <p className="text-red-700 font-semibold">{error}</p>
            </Card>
          )}
        </div>

        {/* Leaderboard Sidebar */}
        <div>
          <Card className="p-6 shadow-lg sticky top-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Live Leaderboard</h3>

            <div className="space-y-2">
              {topScores.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No scores yet</p>
              ) : (
                topScores.map((score) => (
                  <div
                    key={score.participant_id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      score.participant_id === participantId
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-600">#{score.rank}</span>
                        <span className="font-semibold text-gray-900">
                          {score.live_quiz_participants.username}
                        </span>
                        {score.participant_id === participantId && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-bold text-indigo-600">
                        {score.total_points}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {score.total_points > 0 && `${Math.floor(score.total_points / 10)} correct`}
                    </div>
                  </div>
                ))
              )}
            </div>

            {scores.length > 5 && (
              <p className="text-xs text-gray-500 text-center mt-4 pt-4 border-t">
                +{scores.length - 5} more
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
