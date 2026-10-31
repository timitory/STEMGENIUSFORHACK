import { useState, useEffect } from "react";
import { TrendingUp, Trophy, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import rankCardImg from "@/assets/dashboard-rank-card.jpg";

interface ProgressData {
  math: number;
  science: number;
  technology: number;
  engineering: number;
}

interface ProgressPanelProps {
  progress?: ProgressData;
  rank?: number;
  totalStudents?: number;
}

const SUBJECTS = [
  { key: "math", label: "Mathematics", color: "bg-primary", dotColor: "bg-primary" },
  { key: "science", label: "Science", color: "bg-chart-2", dotColor: "bg-chart-2" },
  { key: "technology", label: "Technology", color: "bg-chart-3", dotColor: "bg-chart-3" },
  { key: "engineering", label: "Engineering", color: "bg-chart-4", dotColor: "bg-chart-4" },
];

export function ProgressPanel({ progress: propProgress, rank: propRank, totalStudents: propTotalStudents }: ProgressPanelProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressData>(
    propProgress && typeof propProgress === 'object' 
      ? { math: (propProgress as any).math || 0, science: (propProgress as any).science || 0, technology: (propProgress as any).technology || 0, engineering: (propProgress as any).engineering || 0 }
      : { math: 0, science: 0, technology: 0, engineering: 0 }
  );
  const [rank, setRank] = useState<number>(propRank || 0);
  const [totalStudents, setTotalStudents] = useState<number>(propTotalStudents || 0);
  const [quizStats, setQuizStats] = useState({ total: 0, streak: 0 });
  const [isLoading, setIsLoading] = useState(!propProgress);

  useEffect(() => { fetchUserProgress(); }, []);

  const fetchUserProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      const [profileRes, leaderboardRes, countRes] = await Promise.all([
        supabase.from("profiles").select("progress, rank").eq("id", user.id).maybeSingle(),
        supabase.from("leaderboard_scores").select("total_quizzes, current_streak, best_streak, total_score").eq("user_id", user.id).maybeSingle(),
        supabase.from("leaderboard_scores").select("*", { count: "exact", head: true }),
      ]);
      if (profileRes.data) {
        const p = profileRes.data.progress as any || {};
        setProgress({ math: Number(p.math) || 0, science: Number(p.science) || 0, technology: Number(p.technology) || 0, engineering: Number(p.engineering) || 0 });
        setRank(profileRes.data.rank || 0);
      }
      if (leaderboardRes.data) {
        setQuizStats({ total: leaderboardRes.data.total_quizzes || 0, streak: leaderboardRes.data.best_streak || leaderboardRes.data.current_streak || 0 });
      }
      setTotalStudents(countRes.count || 0);
    } catch (error) {
      console.error("Error fetching progress:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-xl bg-card border border-border/50 flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totalProgress = Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / 4);

  return (
    <div className="space-y-4">
      {/* Overall Progress - Glass card */}
      <div className="p-5 rounded-xl glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Progress</h2>
              <p className="text-[11px] text-muted-foreground">Overall completion</p>
            </div>
          </div>
          <span className="text-2xl font-extrabold gradient-text-primary">{totalProgress}%</span>
        </div>

        {/* Circular-style overall bar */}
        <div className="h-2 bg-secondary rounded-full overflow-hidden mb-5 relative">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ 
              width: `${totalProgress}%`,
              background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-3)))"
            }} 
          />
          <div 
            className="absolute top-0 h-full rounded-full blur-sm opacity-50"
            style={{ 
              width: `${totalProgress}%`,
              background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-3)))"
            }} 
          />
        </div>
        
        <div className="space-y-3">
          {SUBJECTS.map(({ key, label, color, dotColor }) => {
            const value = progress[key as keyof ProgressData];
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">{value}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {totalProgress === 0 && (
          <p className="text-[11px] text-muted-foreground text-center mt-4 py-2 px-3 rounded-lg bg-secondary/50">
            Complete quizzes to track your learning progress
          </p>
        )}
      </div>

      {/* Rank Card with background image */}
      <div className="relative rounded-xl overflow-hidden group">
        <img src={rankCardImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50" />
        <div className="relative p-5 text-center">
          <div className="w-14 h-14 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-3 border border-accent/20 glow-accent">
            <Trophy className="w-7 h-7 text-accent" />
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Your Rank</p>
          <div className="text-4xl font-extrabold gradient-text-accent mb-1">
            {rank > 0 ? `#${rank}` : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            {totalStudents > 0 ? `of ${totalStudents.toLocaleString()} students` : "Complete quizzes to rank"}
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full h-9 text-xs font-semibold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 hover:scale-[1.02] transition-all" 
            onClick={() => navigate('/leaderboard')}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            View Leaderboard
          </Button>
        </div>
      </div>

      {/* Quick Stats Mini - Glass */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl glass-card text-center group hover:scale-[1.02] transition-transform">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Quizzes</p>
          <p className="text-2xl font-extrabold text-foreground">{quizStats.total}</p>
        </div>
        <div className="p-3 rounded-xl glass-card text-center group hover:scale-[1.02] transition-transform">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Best Streak</p>
          <p className="text-2xl font-extrabold text-foreground">{quizStats.streak}</p>
        </div>
      </div>
    </div>
  );
}
