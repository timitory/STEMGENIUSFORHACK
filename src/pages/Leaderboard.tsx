import { useState, useEffect } from "react";
import heroLeaderboardImg from "@/assets/hero-leaderboard.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, ArrowLeft, Target, Flame, Crown, TrendingUp, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  name: string;
  total_score: number;
  total_quizzes: number;
  total_correct: number;
  total_questions_attempted: number;
  math_score: number;
  science_score: number;
  technology_score: number;
  engineering_score: number;
  accuracy: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "math" | "science" | "technology" | "engineering">("all");

  useEffect(() => {
    fetchLeaderboard();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchLeaderboard = async () => {
    try {
      const { data: scores, error: scoresError } = await supabase
        .from("leaderboard_scores")
        .select("*")
        .order("total_score", { ascending: false })
        .limit(50);

      if (scoresError) throw scoresError;

      if (!scores || scores.length === 0) {
        setLeaders([]);
        setIsLoading(false);
        return;
      }

      const userIds = scores.map(s => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      const formattedData: LeaderboardEntry[] = scores.map((score) => ({
        id: score.id,
        user_id: score.user_id,
        name: profileMap.get(score.user_id) || "Unknown User",
        total_score: score.total_score || 0,
        total_quizzes: score.total_quizzes || 0,
        total_correct: score.total_correct || 0,
        total_questions_attempted: score.total_questions_attempted || 0,
        math_score: score.math_score || 0,
        science_score: score.science_score || 0,
        technology_score: score.technology_score || 0,
        engineering_score: score.engineering_score || 0,
        accuracy: score.total_questions_attempted > 0 
          ? Math.round((score.total_correct / score.total_questions_attempted) * 100) 
          : 0
      }));

      setLeaders(formattedData);
    } catch (error: any) {
      console.error("Error fetching leaderboard:", error);
      toast.error("Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  };

  const sortedLeaders = [...leaders].sort((a, b) => {
    if (filter === "all") return b.total_score - a.total_score;
    const key = `${filter}_score` as keyof LeaderboardEntry;
    return (b[key] as number) - (a[key] as number);
  });

  const currentUserRank = sortedLeaders.findIndex(l => l.user_id === currentUserId) + 1;
  const currentUserEntry = sortedLeaders.find(l => l.user_id === currentUserId);

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center"><Crown className="w-4 h-4 text-accent" /></div>;
    if (rank === 2) return <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Medal className="w-4 h-4 text-muted-foreground" /></div>;
    if (rank === 3) return <div className="w-8 h-8 rounded-lg bg-chart-5/20 flex items-center justify-center"><Award className="w-4 h-4 text-chart-5" /></div>;
    return <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><span className="text-xs font-bold text-muted-foreground">{rank}</span></div>;
  };

  const filters = [
    { key: "all", label: "Overall" },
    { key: "math", label: "Math" },
    { key: "science", label: "Science" },
    { key: "technology", label: "Tech" },
    { key: "engineering", label: "Engineering" },
  ] as const;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Leaderboard</h1>
          </div>
          <Badge className="ml-auto bg-secondary text-muted-foreground border-border/50 text-[10px]">
            <Users className="w-3 h-3 mr-1" />
            {leaders.length} players
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <PageHeroBanner image={heroLeaderboardImg} title="Leaderboard" subtitle="Compete with other STEM learners and climb the rankings" badge="Rankings" />
        {/* Top 3 Podium */}
        {sortedLeaders.length >= 1 && (
          <div className="grid grid-cols-3 gap-3 items-end">
            {/* 2nd Place */}
            <div className="text-center">
              {sortedLeaders[1] ? (
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <Avatar className="w-12 h-12 mx-auto mb-2 ring-2 ring-muted-foreground/30">
                    <AvatarFallback className="bg-secondary text-muted-foreground text-sm font-bold">
                      {sortedLeaders[1].name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <Medal className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground truncate">{sortedLeaders[1].name.split(" ")[0]}</p>
                  <p className="text-lg font-bold text-foreground">{sortedLeaders[1].total_score.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">points</p>
                </div>
              ) : <div />}
            </div>

            {/* 1st Place */}
            <div className="text-center">
              <div className="p-5 rounded-xl bg-card border border-accent/30 glow-accent relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Badge className="bg-accent text-accent-foreground text-[10px] h-5 px-2">#1</Badge>
                </div>
                <Avatar className="w-14 h-14 mx-auto mb-2 ring-2 ring-accent/50">
                  <AvatarFallback className="bg-accent/10 text-accent text-sm font-bold">
                    {sortedLeaders[0].name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <Crown className="w-5 h-5 text-accent mx-auto mb-1" />
                <p className="text-xs font-semibold text-foreground truncate">{sortedLeaders[0].name.split(" ")[0]}</p>
                <p className="text-xl font-bold gradient-text-accent">{sortedLeaders[0].total_score.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">points</p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="text-center">
              {sortedLeaders[2] ? (
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <Avatar className="w-12 h-12 mx-auto mb-2 ring-2 ring-chart-5/30">
                    <AvatarFallback className="bg-chart-5/10 text-chart-5 text-sm font-bold">
                      {sortedLeaders[2].name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <Award className="w-5 h-5 text-chart-5 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground truncate">{sortedLeaders[2].name.split(" ")[0]}</p>
                  <p className="text-lg font-bold text-foreground">{sortedLeaders[2].total_score.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">points</p>
                </div>
              ) : <div />}
            </div>
          </div>
        )}

        {/* Your Position */}
        {currentUserEntry && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              {getRankDisplay(currentUserRank)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Your Position</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Target className="w-3 h-3" />{currentUserEntry.accuracy}% accuracy
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Flame className="w-3 h-3" />{currentUserEntry.total_quizzes} quizzes
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">{currentUserEntry.total_score.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">points</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filter === f.key 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {sortedLeaders.length === 0 ? (
          <div className="p-12 rounded-xl bg-card border border-border/50 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No scores yet</h3>
            <p className="text-xs text-muted-foreground mb-4">Be the first to complete a STEM challenge!</p>
            <Button size="sm" onClick={() => navigate("/stem-challenge-arena")} className="h-8 text-xs">
              Start Challenge
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedLeaders.map((leader, index) => {
              const rank = index + 1;
              const isCurrentUser = leader.user_id === currentUserId;
              const displayScore = filter === "all" 
                ? leader.total_score 
                : leader[`${filter}_score` as keyof LeaderboardEntry] as number;
              
              return (
                <div
                  key={leader.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentUser 
                      ? 'bg-primary/5 border border-primary/20' 
                      : 'bg-card border border-border/50 hover:border-border'
                  }`}
                >
                  {getRankDisplay(rank)}

                  <Avatar className="w-8 h-8">
                    <AvatarFallback className={`text-[10px] font-bold ${
                      isCurrentUser ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {leader.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {leader.name}
                      {isCurrentUser && <span className="text-primary ml-1.5 font-normal">(You)</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{leader.accuracy}% acc</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{leader.total_quizzes} quizzes</span>
                    </div>
                  </div>

                  {/* Subject pills - only show on "all" filter */}
                  {filter === "all" && (
                    <div className="hidden sm:flex items-center gap-1">
                      {leader.math_score > 0 && <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-medium">M:{leader.math_score}</span>}
                      {leader.science_score > 0 && <span className="px-1.5 py-0.5 bg-chart-2/10 text-chart-2 rounded text-[9px] font-medium">S:{leader.science_score}</span>}
                      {leader.technology_score > 0 && <span className="px-1.5 py-0.5 bg-chart-3/10 text-chart-3 rounded text-[9px] font-medium">T:{leader.technology_score}</span>}
                      {leader.engineering_score > 0 && <span className="px-1.5 py-0.5 bg-chart-4/10 text-chart-4 rounded text-[9px] font-medium">E:{leader.engineering_score}</span>}
                    </div>
                  )}

                  <div className="text-right min-w-[60px]">
                    <p className={`text-sm font-bold ${rank <= 3 ? 'text-primary' : 'text-foreground'}`}>
                      {displayScore.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-foreground">pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
