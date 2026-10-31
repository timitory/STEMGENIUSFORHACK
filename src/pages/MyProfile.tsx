import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, User, Trophy, Mic, GraduationCap, BookOpen, Video, 
  Crown, Edit2, Save, X, History, TrendingUp, Copy
} from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string;
  is_premium: boolean | null;
  rank: number | null;
  followers_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  progress: Record<string, number> | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  email_confirmed?: boolean | null;
}

interface QuizAttempt {
  id: string;
  quiz_id?: string | null;
  user_id?: string;
  user_name?: string;
  quiz_title?: string;
  quiz_code?: string;
  subject: string;
  topic: string | null;
  score: number;
  total_points: number;
  correct_answers: number;
  total_questions: number;
  completed_at: string | null;
  time_taken?: number | null;
  answers?: any;
  user_answers?: number[] | null;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  topic: string | null;
  difficulty: string;
  quiz_code: string;
  cash_prize: number | null;
  gift_description: string | null;
  total_questions: number | null;
  creator_id: string;
  is_ai_generated: boolean | null;
  created_at: string | null;
}

interface VoiceTutorSession {
  id: string;
  question: string;
  response: string;
  language: string;
  voice: string;
  created_at: string;
}

interface CareerAssessment {
  id: string;
  interests: string[] | null;
  skills: string[] | null;
  education_level: string | null;
  location: string | null;
  career_goals: string | null;
  ai_recommendations: any;
  created_at: string;
}

interface HomeworkSession {
  id: string;
  question_text: string | null;
  response_text: string;
  created_at: string;
}

interface Reel {
  id: string;
  title: string | null;
  views_count: number;
  likes_count: number;
  created_at: string;
  thumbnail_url: string | null;
}

export default function MyProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Activity data
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [voiceSessions, setVoiceSessions] = useState<VoiceTutorSession[]>([]);
  const [careerAssessments, setCareerAssessments] = useState<CareerAssessment[]>([]);
  const [homeworkSessions, setHomeworkSessions] = useState<HomeworkSession[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [createdQuizzes, setCreatedQuizzes] = useState<Quiz[]>([]);
  const [createdQuizAttempts, setCreatedQuizAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchAllData(session.user.id);
  };

  const fetchAllData = async (userId: string) => {
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (profileData) {
        setProfile(profileData as unknown as Profile);
        setEditName(profileData.name);
        setEditPhone(profileData.phone || "");
        setEditGender(profileData.gender || "");
        setEditAddress(profileData.address || "");
      }

      // Fetch quiz attempts
      const { data: quizData } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(10);
      
      if (quizData) setQuizAttempts(quizData);

      // Fetch quizzes created by this user and attempt performance on them
      const { data: createdQuizzesData } = await supabase
        .from("quizzes")
        .select("*")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      const createdQuizzesList = createdQuizzesData || [];
      setCreatedQuizzes(createdQuizzesList as Quiz[]);

      if (createdQuizzesList.length > 0) {
        const quizIds = createdQuizzesList.map((quiz) => quiz.id);
        const { data: createdAttemptsData } = await supabase
          .from("quiz_attempts")
          .select("*")
          .in("quiz_id", quizIds)
          .order("completed_at", { ascending: false })
          .limit(50);

        if (createdAttemptsData) {
          const userIds = Array.from(new Set(createdAttemptsData.map((attempt) => attempt.user_id)));
          const profileMap: Record<string, string> = {};

          if (userIds.length > 0) {
            const { data: profileRows } = await supabase
              .from("profiles")
              .select("id,name")
              .in("id", userIds);

            (profileRows || []).forEach((profile) => {
              if (profile?.id && profile?.name) {
                profileMap[profile.id] = profile.name;
              }
            });
          }

          const quizMap: Record<string, Quiz> = {};
          createdQuizzesList.forEach((quiz) => {
            quizMap[quiz.id] = quiz as Quiz;
          });

          setCreatedQuizAttempts(
            (createdAttemptsData as QuizAttempt[]).map((attempt) => ({
              ...attempt,
              user_name:
                attempt.user_id === userId
                  ? "You"
                  : profileMap[attempt.user_id || ""] || "Guest",
              quiz_title:
                attempt.quiz_id && quizMap[attempt.quiz_id]
                  ? quizMap[attempt.quiz_id].title
                  : attempt.subject,
              quiz_code:
                attempt.quiz_id && quizMap[attempt.quiz_id]
                  ? quizMap[attempt.quiz_id].quiz_code
                  : undefined,
            }))
          );
        }
      }

      // Fetch voice tutor sessions
      const { data: voiceData } = await supabase
        .from("voice_tutor_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (voiceData) setVoiceSessions(voiceData);

      // Fetch career assessments
      const { data: careerData } = await supabase
        .from("career_assessments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (careerData) setCareerAssessments(careerData as unknown as CareerAssessment[]);

      // Fetch homework sessions
      const { data: homeworkData } = await supabase
        .from("homework_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (homeworkData) setHomeworkSessions(homeworkData);

      // Fetch reels
      const { data: reelsData } = await supabase
        .from("reels")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (reelsData) setReels(reelsData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          gender: editGender || null,
          address: editAddress.trim() || null,
        })
        .eq("id", user.id);
      
      if (error) throw error;
      
      setProfile(prev =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              phone: editPhone,
              gender: editGender,
              address: editAddress,
            }
          : null
      );
      setIsEditing(false);
      await fetchAllData(user.id);
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const copyQuizLink = async (quizCode: string) => {
    const shareUrl = `${window.location.origin}/stem-challenge-arena?code=${quizCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Quiz link copied to clipboard!");
    } catch {
      toast.error("Failed to copy quiz link");
    }
  };

  const createdQuizSummaries = useMemo(() => {
    return createdQuizzes.map((quiz) => {
      const attempts = createdQuizAttempts.filter((attempt) => attempt.quiz_id === quiz.id);
      const totalAttempts = attempts.length;
      const completedAttempts = attempts.filter((attempt) =>
        Boolean(attempt.completed_at) ||
        (attempt.user_answers?.length && attempt.total_questions && attempt.user_answers.length === attempt.total_questions)
      ).length;
      const uniqueUsers = new Set(attempts.filter((attempt) => attempt.user_id).map((attempt) => attempt.user_id)).size;
      const averageScore = totalAttempts > 0
        ? attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / totalAttempts
        : 0;
      const scores = attempts.map((attempt) => attempt.score || 0);
      const highestScore = totalAttempts > 0 ? Math.max(...scores) : 0;
      const lowestScore = totalAttempts > 0 ? Math.min(...scores) : 0;
      const averageTime = totalAttempts > 0
        ? attempts.reduce((sum, attempt) => sum + (attempt.time_taken || 0), 0) / totalAttempts
        : 0;
      const totalCorrect = attempts.reduce((sum, attempt) => sum + (attempt.correct_answers || 0), 0);
      const totalIncorrect = attempts.reduce((sum, attempt) => sum + (((attempt.total_questions || 0) - (attempt.correct_answers || 0)) || 0), 0);

      return {
        quiz,
        totalAttempts,
        uniqueUsers,
        completionRate: totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0,
        averageScore: Math.round(averageScore),
        highestScore,
        lowestScore,
        averageTime: Math.round(averageTime),
        totalCorrect,
        totalIncorrect,
      };
    });
  }, [createdQuizzes, createdQuizAttempts]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Profile Header */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                {profile?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full"
                        placeholder="e.g. +1234567890"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={editGender} onValueChange={(value) => setEditGender(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="icon" onClick={handleSaveProfile}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{profile?.name}</h2>
                  {profile?.is_premium && (
                    <Crown className="w-5 h-5 text-yellow-500" />
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {profile?.email_confirmed != null && (
                <div className="text-sm text-muted-foreground mt-2">
                  Email: <span className="font-medium text-foreground">{user?.email}</span>
                  <span className="ml-2">
                    {profile.email_confirmed ? "(Verified)" : "(Unverified)"}
                  </span>
                </div>
              )}

              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {profile?.phone && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile?.gender && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="capitalize">{profile.gender.replace("_", " ")}</span>
                  </div>
                )}
                {profile?.address && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{profile.address}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span><strong>{profile?.followers_count || 0}</strong> followers</span>
                <span><strong>{profile?.following_count || 0}</strong> following</span>
                <span><strong>{profile?.likes_count || 0}</strong> likes</span>
              </div>
              
              {profile?.rank && (
                <Badge variant="secondary" className="mt-2">
                  <Trophy className="w-3 h-3 mr-1" />
                  Rank #{profile.rank}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {profile?.progress && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(profile.progress).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{key}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Activity Tabs */}
        <Tabs defaultValue="quizzes">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="quizzes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="w-4 h-4 mr-2" />
              Quizzes ({quizAttempts.length})
            </TabsTrigger>
            <TabsTrigger value="created" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4 mr-2" />
              Created ({createdQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="voice" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Mic className="w-4 h-4 mr-2" />
              Voice Tutor ({voiceSessions.length})
            </TabsTrigger>
            <TabsTrigger value="career" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <GraduationCap className="w-4 h-4 mr-2" />
              Career ({careerAssessments.length})
            </TabsTrigger>
            <TabsTrigger value="homework" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Homework ({homeworkSessions.length})
            </TabsTrigger>
            <TabsTrigger value="reels" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video className="w-4 h-4 mr-2" />
              Reels ({reels.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quizzes" className="mt-4">
            <Card className="p-4">
              {quizAttempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No quiz attempts yet</p>
              ) : (
                <div className="space-y-3">
                  {quizAttempts.map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{attempt.subject}</p>
                        {attempt.topic && <p className="text-sm text-muted-foreground">{attempt.topic}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{attempt.score} pts</p>
                        <p className="text-sm text-muted-foreground">
                          {attempt.correct_answers}/{attempt.total_questions} correct
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="created" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Created Quizzes</h3>
                  <p className="text-sm text-muted-foreground">
                    Share your own quiz links and review performance for learners who attempted them.
                  </p>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {createdQuizzes.length} quizzes
                </Badge>
              </div>

              {createdQuizzes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">You haven't saved any created quizzes yet.</p>
              ) : (
                <div className="space-y-3">
                  {createdQuizzes.map((quiz) => (
                    <div key={quiz.id} className="p-4 bg-muted/50 rounded-lg grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                      <div>
                        <p className="font-medium">{quiz.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {quiz.subject}{quiz.topic ? ` • ${quiz.topic}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Code: {quiz.quiz_code} • {quiz.total_questions ?? 0} questions • {quiz.is_ai_generated ? "AI generated" : "Manual"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/stem-challenge-arena?code=${quiz.quiz_code}`)}>
                          Open Quiz
                        </Button>
                        <Button size="sm" onClick={() => copyQuizLink(quiz.quiz_code)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {createdQuizSummaries.some((summary) => summary.totalAttempts > 0) && (
                <div className="pt-4 border-t border-border">
                  <div className="mb-4">
                    <h4 className="text-base font-semibold">Quiz Attempt Overview</h4>
                    <p className="text-sm text-muted-foreground">Metrics for each quiz you created, including completion, score and question performance.</p>
                  </div>
                  <div className="space-y-4">
                    {createdQuizSummaries.map((summary) => (
                      <div key={summary.quiz.id} className="p-4 bg-secondary/10 rounded-xl border border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="font-semibold">{summary.quiz.title}</p>
                            <p className="text-sm text-muted-foreground">Code: {summary.quiz.quiz_code} • {summary.quiz.subject}</p>
                          </div>
                          <Badge variant="secondary" className="text-sm">
                            {summary.totalAttempts} attempts
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Unique users</p>
                            <p className="font-semibold">{summary.uniqueUsers}</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Completion rate</p>
                            <p className="font-semibold">{summary.completionRate}%</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Average score</p>
                            <p className="font-semibold">{summary.averageScore}</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Time per attempt</p>
                            <p className="font-semibold">{summary.averageTime}s</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Highest / lowest</p>
                            <p className="font-semibold">{summary.highestScore} / {summary.lowestScore}</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Total correct</p>
                            <p className="font-semibold">{summary.totalCorrect}</p>
                          </div>
                          <div className="rounded-md bg-background p-3">
                            <p className="text-muted-foreground">Total incorrect</p>
                            <p className="font-semibold">{summary.totalIncorrect}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Attempts on Your Quizzes</h3>
                    <p className="text-sm text-muted-foreground">See who attempted your quizzes and how they performed.</p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {createdQuizAttempts.length} attempts
                  </Badge>
                </div>

                {createdQuizAttempts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No attempts have been recorded for your quizzes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {createdQuizAttempts.map((attempt) => (
                      <div key={attempt.id} className="p-4 bg-muted/50 rounded-lg grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                        <div>
                          <p className="font-medium">{attempt.quiz_title || attempt.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {attempt.user_name || attempt.user_id || "Guest"} • {attempt.correct_answers}/{attempt.total_questions} correct
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(attempt.completed_at).toLocaleDateString()} • {attempt.score} pts
                          </p>
                        </div>
                        {attempt.quiz_code ? (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/stem-challenge-arena?code=${attempt.quiz_code}`)}>
                            View Quiz
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="mt-4">
            <Card className="p-4">
              {voiceSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No voice tutor sessions yet</p>
              ) : (
                <div className="space-y-3">
                  {voiceSessions.map((session) => (
                    <div key={session.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{session.language} - {session.voice}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium text-sm mb-1">Q: {session.question.slice(0, 100)}...</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{session.response.slice(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="career" className="mt-4">
            <Card className="p-4">
              {careerAssessments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No career assessments yet</p>
              ) : (
                <div className="space-y-3">
                  {careerAssessments.map((assessment) => (
                    <div key={assessment.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{assessment.education_level}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {assessment.interests?.slice(0, 3).map((interest) => (
                          <Badge key={interest} variant="secondary" className="text-xs">{interest}</Badge>
                        ))}
                        {assessment.interests && assessment.interests.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{assessment.interests.length - 3}</Badge>
                        )}
                      </div>
                      {assessment.career_goals && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{assessment.career_goals}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="homework" className="mt-4">
            <Card className="p-4">
              {homeworkSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No homework sessions yet</p>
              ) : (
                <div className="space-y-3">
                  {homeworkSessions.map((session) => (
                    <div key={session.id} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                      {session.question_text && (
                        <p className="font-medium text-sm mb-1">Q: {session.question_text.slice(0, 100)}...</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">{session.response_text.slice(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="reels" className="mt-4">
            <Card className="p-4">
              {reels.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No reels created yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {reels.map((reel) => (
                    <div 
                      key={reel.id} 
                      className="aspect-[9/16] bg-muted rounded-lg relative overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/stem-reels?reelId=${reel.id}`, { state: { reelId: reel.id } })}
                    >
                      {reel.thumbnail_url ? (
                        <img src={reel.thumbnail_url} alt={reel.title || "Reel"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-xs truncate">{reel.title || "Untitled"}</p>
                        <p className="text-white/70 text-xs">{reel.views_count} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}