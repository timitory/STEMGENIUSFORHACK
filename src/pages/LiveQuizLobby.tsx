import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, LogOut, Play } from 'lucide-react';
import { useLiveQuizLobby } from '@/hooks/useLiveQuiz';
import * as liveQuizUtils from '@/lib/liveQuizUtils';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  id: string;
  username: string;
  is_ready: boolean;
}

export const LiveQuizLobby: React.FC = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { participants, allReady, loading: lobbyLoading, error: lobbyError } = useLiveQuizLobby(quizId || null);

  // Initialize participant data
  useEffect(() => {
    const initializeParticipant = async () => {
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

        // Get quiz details
        const quiz = await liveQuizUtils.getQuiz(quizId);
        if (!quiz) {
          setError('Quiz not found');
          setLoading(false);
          return;
        }

        setInviteCode(quiz.invite_code);

        // Check if user is already a participant
        const existingParticipants = await liveQuizUtils.getParticipants(quizId);
        const existing = existingParticipants.find(p => p.user_id === user.id);

        if (existing) {
          setParticipantId(existing.id);
          setUsername(existing.username);
          setIsReady(existing.is_ready);
        } else {
          // User joined but not yet in participants - shouldn't happen
          setError('You are not a participant in this quiz');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initializeParticipant();
  }, [quizId, navigate]);

  // Handle ready status toggle
  const handleReadyClick = async () => {
    if (!participantId) return;

    try {
      await liveQuizUtils.updateReadyStatus(participantId, !isReady);
      setIsReady(!isReady);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ready status');
    }
  };

  // Handle start quiz
  const handleStartQuiz = async () => {
    if (!quizId || !allReady) return;

    try {
      await liveQuizUtils.startLiveQuiz(quizId);
      navigate(`/live-quiz/${quizId}/play`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start quiz');
    }
  };

  // Handle leave quiz
  const handleLeaveQuiz = async () => {
    if (!participantId) return;

    try {
      await liveQuizUtils.leaveQuiz(participantId);
      navigate('/live-quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave quiz');
    }
  };

  // Copy invite code
  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || lobbyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 max-w-md w-full shadow-lg">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/live-quiz')} className="w-full">
            Back to Quizzes
          </Button>
        </Card>
      </div>
    );
  }

  const readyCount = participants.filter(p => p.is_ready).length;
  const totalParticipants = participants.length;
  const isCreator = participants[0]?.id === participantId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Live Quiz Lobby</h1>
          <p className="text-gray-600">Waiting for all participants to be ready...</p>
        </div>

        {/* Invite Code Card */}
        <Card className="mb-8 p-6 shadow-lg border-2 border-indigo-200 bg-white">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Invite Code</h2>
          <div className="flex items-center gap-2 mb-2">
            <code className="text-4xl font-bold text-indigo-600">{inviteCode}</code>
            <Button
              onClick={handleCopyCode}
              variant="ghost"
              size="lg"
              className="ml-auto"
              title="Copy invite code"
            >
              <Copy className="h-6 w-6 text-indigo-600" />
            </Button>
          </div>
          {copied && <p className="text-sm text-green-600 font-medium">Copied to clipboard!</p>}
          <p className="text-xs text-gray-500 mt-2">Share this code with others to let them join</p>
        </Card>

        {/* Participants Card */}
        <Card className="mb-8 p-6 shadow-lg bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Participants</h2>
            <span className="text-lg font-semibold text-indigo-600">
              {readyCount}/{totalParticipants} Ready
            </span>
          </div>

          {/* Ready Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${totalParticipants > 0 ? (readyCount / totalParticipants) * 100 : 0}%` }}
            />
          </div>

          {/* Participants List */}
          <div className="space-y-3">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  participant.is_ready
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      participant.is_ready ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="font-medium text-gray-900">{participant.username}</span>
                  {participant.id === participantId && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold">
                  {participant.is_ready ? (
                    <span className="text-green-600">✓ Ready</span>
                  ) : (
                    <span className="text-gray-500">Waiting...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Your Status Card */}
        <Card className="mb-8 p-6 shadow-lg bg-white border-2 border-indigo-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Your Status</h3>
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${isReady ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-lg font-medium text-gray-700">
              {isReady ? '✓ You are ready' : 'Not ready'}
            </span>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleReadyClick}
            className={`w-full py-6 text-lg font-bold rounded-lg transition-all ${
              isReady
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isReady ? '✓ Ready - Click to Unready' : 'I\'m Ready!'}
          </Button>

          {isCreator && allReady && totalParticipants > 0 ? (
            <Button
              onClick={handleStartQuiz}
              className="w-full py-6 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Play className="h-6 w-6" />
              Start Quiz!
            </Button>
          ) : isCreator ? (
            <div className="w-full py-6 text-center bg-gray-200 text-gray-600 rounded-lg font-semibold">
              Waiting for all to ready ({readyCount}/{totalParticipants})
            </div>
          ) : (
            <div className="w-full py-6 text-center bg-gray-100 text-gray-600 rounded-lg font-semibold">
              Waiting for creator to start...
            </div>
          )}

          <Button
            onClick={handleLeaveQuiz}
            variant="outline"
            className="w-full py-3 text-base font-semibold border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2"
          >
            <LogOut className="h-5 w-5" />
            Leave Quiz
          </Button>
        </div>

        {lobbyError && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            Real-time sync issue: {lobbyError}
          </div>
        )}
      </div>
    </div>
  );
};
