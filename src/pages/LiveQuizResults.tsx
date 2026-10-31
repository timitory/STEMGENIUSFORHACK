import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Trophy } from 'lucide-react';
import { useQuestionAnswers, useLiveQuizScores } from '@/hooks/useLiveQuiz';
import * as liveQuizUtils from '@/lib/liveQuizUtils';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  points: number;
  order_index: number;
}

interface Answer {
  id: string;
  participant_id: string;
  selected_answer: number;
  is_correct: boolean;
  points_earned: number;
  live_quiz_participants: {
    id: string;
    username: string;
  };
}

export const LiveQuizResults: React.FC = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();

  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoAdvanceIn, setAutoAdvanceIn] = useState(5);

  const { answers, loading: answersLoading } = useQuestionAnswers(quizId || null, questionIndex);
  const { scores } = useLiveQuizScores(quizId || null);

  // Initialize and load question
  useEffect(() => {
    const initializeResults = async () => {
      if (!quizId) {
        setError('No quiz ID provided');
        setLoading(false);
        return;
      }

      try {
        const quiz = await liveQuizUtils.getQuiz(quizId);
        if (!quiz) {
          setError('Quiz not found');
          setLoading(false);
          return;
        }

        setQuestionIndex(quiz.current_question_index || 0);
        setTotalQuestions(quiz.questions_count);

        const q = await liveQuizUtils.getCurrentQuestion(quizId, quiz.current_question_index || 0);
        if (q) {
          setQuestion(q);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initializeResults();
  }, [quizId]);

  // Auto-advance timer
  useEffect(() => {
    if (!question || autoAdvanceIn <= 0) {
      if (questionIndex + 1 < totalQuestions) {
        handleAdvance();
      } else {
        // Last question - go to final results
        navigate(`/live-quiz/${quizId}/final`);
      }
      return;
    }

    const timer = setInterval(() => {
      setAutoAdvanceIn(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [autoAdvanceIn, question, questionIndex, totalQuestions, navigate, quizId]);

  const handleAdvance = async () => {
    if (!quizId) return;

    try {
      const nextQuestionIndex = questionIndex + 1;
      
      if (nextQuestionIndex < totalQuestions) {
        // Move to next question
        await liveQuizUtils.advanceToNextQuestion(quizId, nextQuestionIndex);
        navigate(`/live-quiz/${quizId}/play`);
      } else {
        // Quiz finished
        await liveQuizUtils.finishQuiz(quizId);
        navigate(`/live-quiz/${quizId}/final`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance');
    }
  };

  if (loading || answersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 max-w-md w-full shadow-lg">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Question not found'}</p>
          <Button onClick={() => navigate('/live-quiz')} className="w-full">
            Back to Quizzes
          </Button>
        </Card>
      </div>
    );
  }

  const correctAnswerCount = answers.filter(a => a.is_correct).length;
  const totalParticipants = scores.length;
  const correctPercentage = totalParticipants > 0 
    ? Math.round((correctAnswerCount / totalParticipants) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Results</h1>
          <p className="text-gray-600">Question {questionIndex + 1} of {totalQuestions}</p>
        </div>

        {/* Question Card */}
        <Card className="mb-8 p-8 shadow-lg bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{question.question_text}</h2>

          {/* Answer Options with Correctness */}
          <div className="space-y-3 mb-8">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correct_answer;
              const userAnswers = answers.filter(a => a.selected_answer === index);

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isCorrect
                      ? 'bg-green-50 border-green-500'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {isCorrect && (
                          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                        )}
                        <span className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-gray-700'}`}>
                          {option}
                        </span>
                        {isCorrect && <span className="text-sm font-bold text-green-600 ml-auto">CORRECT</span>}
                      </div>

                      {userAnswers.length > 0 && (
                        <div className="text-sm text-gray-600 ml-9">
                          {userAnswers.map(a => (
                            <div key={a.id} className="flex items-center gap-2">
                              {a.is_correct ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span>{a.live_quiz_participants.username}</span>
                              <span className="font-bold text-indigo-600">+{a.points_earned}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {correctAnswerCount}/{totalParticipants}
                </div>
                <p className="text-gray-600 font-medium">Got it correct</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-1">
                  {correctPercentage}%
                </div>
                <p className="text-gray-600 font-medium">Success rate</p>
              </div>
            </div>
          </div>

          {/* Leaderboard Preview */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Current Top Scores
            </h3>
            <div className="space-y-2">
              {scores.slice(0, 3).map((score, idx) => (
                <div
                  key={score.participant_id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    idx === 0 ? 'bg-amber-50 border-2 border-amber-300' :
                    idx === 1 ? 'bg-gray-50 border-2 border-gray-300' :
                    'bg-orange-50 border-2 border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {score.live_quiz_participants.username}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-indigo-600">
                    {score.total_points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Auto-advance Notice */}
        <Card className="p-6 bg-blue-50 border border-blue-300">
          <p className="text-blue-700 font-semibold text-center">
            {questionIndex + 1 < totalQuestions 
              ? `Moving to next question in ${autoAdvanceIn} seconds...`
              : `Moving to final results in ${autoAdvanceIn} seconds...`
            }
          </p>
          <Button
            onClick={handleAdvance}
            className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
          >
            {questionIndex + 1 < totalQuestions ? 'Next Question' : 'View Final Results'}
          </Button>
        </Card>

        {error && (
          <Card className="mt-4 p-4 bg-red-50 border border-red-200">
            <p className="text-red-700 font-semibold">{error}</p>
          </Card>
        )}
      </div>
    </div>
  );
};
