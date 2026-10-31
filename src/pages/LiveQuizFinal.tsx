import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, RotateCw } from 'lucide-react';
import { useLiveQuizScores } from '@/hooks/useLiveQuiz';
import * as liveQuizUtils from '@/lib/liveQuizUtils';
import { supabase } from '@/integrations/supabase/client';

interface Score {
  rank: number;
  live_quiz_participants: { id: string; username: string };
  total_points: number;
  correct_count: number;
  participant_id: string;
}

export const LiveQuizFinal: React.FC = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState<string | null>(null);

  const { scores, loading: scoresLoading } = useLiveQuizScores(quizId || null);

  // Initialize
  useEffect(() => {
    const initializeResults = async () => {
      if (!quizId) {
        setError('No quiz ID provided');
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }

        // Get participant ID
        const participants = await liveQuizUtils.getParticipants(quizId);
        if (user) {
          const currentParticipant = participants.find(p => p.user_id === user.id);
          if (currentParticipant) {
            setParticipantId(currentParticipant.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initializeResults();
  }, [quizId]);

  const handlePlayAgain = async () => {
    try {
      navigate('/live-quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate');
    }
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  if (loading || scoresLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading final results...</p>
        </div>
      </div>
    );
  }

  const sortedScores = [...scores].sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    return b.correct_count - a.correct_count;
  });

  const first = sortedScores[0];
  const second = sortedScores[1];
  const third = sortedScores[2];
  const userScore = sortedScores.find(s => s.participant_id === participantId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
      {/* Confetti Animation (simple CSS) */}
      <style>
        {`
          @keyframes confetti-fall {
            to { transform: translateY(100vh) rotate(360deg); opacity: 0; }
          }
          .confetti { animation: confetti-fall 3s ease-in forwards; }
        `}
      </style>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            🎉 Quiz Complete! 🎉
          </h1>
          <p className="text-xl text-gray-600">Final Rankings</p>
        </div>

        {/* Podium - Top 3 */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 2nd Place */}
            {second && (
              <Card className="p-6 shadow-lg bg-white border-4 border-gray-400 transform md:translate-y-8">
                <div className="text-center">
                  <div className="text-6xl mb-2">🥈</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {second.live_quiz_participants.username}
                  </h2>
                  <p className="text-gray-600 text-sm mb-3">2nd Place</p>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">
                    {second.total_points}
                  </div>
                  <p className="text-gray-500 text-xs">
                    {second.correct_count} correct answers
                  </p>
                </div>
              </Card>
            )}

            {/* 1st Place */}
            {first && (
              <Card className="p-8 shadow-2xl bg-gradient-to-b from-amber-50 to-white border-4 border-amber-400 transform -translate-y-4">
                <div className="text-center">
                  <div className="text-7xl mb-2">🥇</div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {first.live_quiz_participants.username}
                  </h2>
                  <p className="text-amber-600 text-lg font-bold mb-3">WINNER!</p>
                  <div className="text-5xl font-bold text-amber-600 mb-2">
                    {first.total_points}
                  </div>
                  <p className="text-gray-500 text-sm">
                    {first.correct_count} correct answers
                  </p>
                  <Trophy className="h-8 w-8 text-amber-500 mx-auto mt-4" />
                </div>
              </Card>
            )}

            {/* 3rd Place */}
            {third && (
              <Card className="p-6 shadow-lg bg-white border-4 border-orange-400 transform md:translate-y-8">
                <div className="text-center">
                  <div className="text-6xl mb-2">🥉</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {third.live_quiz_participants.username}
                  </h2>
                  <p className="text-gray-600 text-sm mb-3">3rd Place</p>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">
                    {third.total_points}
                  </div>
                  <p className="text-gray-500 text-xs">
                    {third.correct_count} correct answers
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* User's Position Highlight */}
          {userScore && userScore.rank > 3 && (
            <Card className="p-6 bg-blue-50 border-2 border-blue-300 mb-8">
              <div className="text-center">
                <p className="text-gray-600 font-medium mb-2">Your Final Position</p>
                <div className="flex items-center justify-center gap-4">
                  <Medal className="h-8 w-8 text-indigo-600" />
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">#{userScore.rank}</p>
                    <p className="text-gray-600">{userScore.total_points} points</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Full Leaderboard */}
        <Card className="p-8 shadow-lg bg-white mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Full Leaderboard</h2>

          <div className="space-y-2">
            {sortedScores.map((score, index) => {
              const isUser = score.participant_id === participantId;
              let medallion = '';
              
              if (index === 0) medallion = '🥇';
              else if (index === 1) medallion = '🥈';
              else if (index === 2) medallion = '🥉';

              return (
                <div
                  key={score.participant_id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isUser
                      ? 'bg-blue-50 border-blue-300'
                      : index < 3
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl">{medallion || `#${index + 1}`}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">
                        {score.live_quiz_participants.username}
                        {isUser && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {score.correct_count} correct
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600">
                      {score.total_points}
                    </p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Statistics */}
        {sortedScores.length > 0 && (
          <Card className="p-8 shadow-lg bg-gradient-to-r from-indigo-50 to-blue-50 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quiz Statistics</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-indigo-600 mb-1">
                  {sortedScores.length}
                </p>
                <p className="text-gray-600 text-sm">Participants</p>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 mb-1">
                  {sortedScores.reduce((sum, s) => sum + s.correct_count, 0)}
                </p>
                <p className="text-gray-600 text-sm">Total Correct</p>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 mb-1">
                  {first ? first.total_points : 0}
                </p>
                <p className="text-gray-600 text-sm">Highest Score</p>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600 mb-1">
                  {Math.round(
                    (sortedScores.reduce((sum, s) => sum + s.correct_count, 0) / 
                      (sortedScores.length)) * 100
                  )}%
                </p>
                <p className="text-gray-600 text-sm">Avg. Accuracy</p>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handlePlayAgain}
            className="w-full py-4 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-lg"
          >
            <RotateCw className="h-5 w-5" />
            Play Another Quiz
          </Button>

          <Button
            onClick={handleBackToMenu}
            variant="outline"
            className="w-full py-4 text-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Back to Menu
          </Button>
        </div>

        {error && (
          <Card className="mt-6 p-4 bg-red-50 border border-red-200">
            <p className="text-red-700 font-semibold">{error}</p>
          </Card>
        )}
      </div>
    </div>
  );
};
