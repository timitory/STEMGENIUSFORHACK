import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Users, LogOut, Video, Radio, Sparkles } from 'lucide-react';
import * as liveQuizUtils from '@/lib/liveQuizUtils';
import { supabase } from '@/integrations/supabase/client';
import { createVirtualClass } from '@/lib/virtualClassService';

interface Quiz {
  id: string;
  title: string;
  description: string;
  invite_code: string;
  status: string;
  questions_count: number;
  created_at: string;
}

export const LiveQuizHub: React.FC = () => {
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUsername(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Player');
      }
    };

    getCurrentUser();
  }, []);

  // Handle join by code
  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    if (!username.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await liveQuizUtils.joinLiveQuiz(joinCode, username);
      if (result) {
        navigate(`/live-quiz/${result.quiz.id}/lobby`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join quiz');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (err) {
      setError('Failed to logout');
    }
  };

  const [isStartingMeeting, setIsStartingMeeting] = useState(false);

  const handleStartInstantMeeting = async () => {
    if (!userId) {
      navigate('/auth');
      return;
    }
    setIsStartingMeeting(true);
    try {
      const newClass = await createVirtualClass(userId, {
        title: `${username}'s Live Study Meeting`,
        description: "Interactive real-time study session and quiz discussion with live camera, screen sharing, and audio.",
        subject: "STEM Live Study",
        scheduledStart: new Date().toISOString(),
        durationMinutes: 90,
        maxCapacity: 1000,
        accessType: "public",
        meetingFormat: "webinar",
        isRecordingEnabled: true,
        hostAnnouncements: `Welcome to ${username}'s live study meeting! Turn on your mic or raise hand to speak.`,
      });

      if (newClass) {
        navigate(`/virtual-classes/room/${newClass.room_id}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start meeting");
    } finally {
      setIsStartingMeeting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Live Quiz Hub</h1>
            <p className="text-gray-600">Join or create a live quiz and compete with others</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Welcome Card */}
        <Card className="mb-8 p-8 shadow-lg bg-white border-2 border-indigo-200">
          <div className="text-center">
            <p className="text-lg text-gray-700 mb-2">Welcome back!</p>
            <p className="text-2xl font-bold text-indigo-600">{username}</p>
          </div>
        </Card>

        {/* Start Live Study Meeting / Video Conference */}
        <Card className="mb-8 p-6 sm:p-8 shadow-lg bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-2 border-indigo-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-2">
                <Radio className="h-3 w-3 animate-pulse text-indigo-600" />
                Live Video & Audio Meeting
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Start a Live Study Meeting</h2>
              <p className="text-gray-600 text-sm max-w-md">
                Launch an instant live room for up to 1,000 participants with screen sharing, stage video, audio discussion, and live Q&A.
              </p>
            </div>
            <Button
              onClick={handleStartInstantMeeting}
              disabled={isStartingMeeting}
              className="w-full sm:w-auto px-6 py-4 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              <Video className="h-4 w-4" />
              {isStartingMeeting ? 'Launching Room...' : 'Start Live Meeting Now'}
            </Button>
          </div>
        </Card>

        {/* Join Quiz Section */}
        <Card className="mb-8 p-8 shadow-lg bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Join a Quiz</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Invite Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABC123"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-lg font-bold tracking-widest focus:outline-none focus:border-indigo-600 focus:bg-indigo-50 uppercase"
              />
              <p className="text-xs text-gray-500 mt-2">Ask the quiz creator for the code</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Your Name (for leaderboard)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:bg-indigo-50"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-semibold text-sm">{error}</p>
              </div>
            )}

            <Button
              onClick={handleJoinByCode}
              disabled={!joinCode.trim() || !username.trim() || loading}
              className="w-full py-4 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining...' : 'Join Quiz'}
            </Button>
          </div>
        </Card>

        {/* Create Quiz Section */}
        <Card className="p-8 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Your Own Quiz</h2>
          <p className="text-gray-600 mb-6">
            Build a quiz and invite others to play in real-time. Set questions, points, and watch the live leaderboard.
          </p>
          <Button
            onClick={() => navigate('/live-quiz/create')}
            className="w-full py-4 text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Create New Quiz
          </Button>
        </Card>

        {/* Features */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🎯',
                title: 'Create or Join',
                desc: 'Create a quiz or join with an invite code',
              },
              {
                icon: '✅',
                title: 'Get Ready',
                desc: 'Everyone clicks "ready" to start the quiz',
              },
              {
                icon: '🏆',
                title: 'Compete',
                desc: 'Answer questions and watch your rank climb',
              },
            ].map((feature, idx) => (
              <Card key={idx} className="p-6 shadow-lg text-center bg-white">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            Back to Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
};
