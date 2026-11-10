import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dashboardHeroImg from "@/assets/dashboard-hero-main.jpg";
import challengesBgImg from "@/assets/dashboard-challenges-bg.jpg";
import featuresBgImg from "@/assets/dashboard-features-bg.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { ProgressPanel } from "@/components/dashboard/ProgressPanel";
import { ChallengeCard } from "@/components/dashboard/ChallengeCard";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { PremiumBanner } from "@/components/dashboard/PremiumBanner";
import { AIDialog } from "@/components/dashboard/AIDialog";
import { 
  Calculator, Beaker, Cpu, Brain, Mic, Lightbulb, BookOpen, Video, FileText, Atom, GraduationCap, PlayCircle, Briefcase,
  Rocket, Flame, Target, Zap, Trophy, Plus, Users, Radio, Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<"homework" | "tutor">("tutor");
  const [aiDialogTitle, setAiDialogTitle] = useState("");
  const [stats, setStats] = useState({ quizzes: 0, streak: 0 });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => { if (user) loadProfile(); }, [user]);

  const loadProfile = async () => {
    try {
      const [profileRes, leaderboardRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("leaderboard_scores").select("total_quizzes, current_streak, best_streak").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      setProfile(profileRes.data);
      if (leaderboardRes.data) {
        setStats({
          quizzes: leaderboardRes.data.total_quizzes || 0,
          streak: leaderboardRes.data.best_streak || leaderboardRes.data.current_streak || 0,
        });
      }
      // Check if user is admin
      const adminRole = roleRes.data?.find((r: any) => r.role === 'admin');
      setIsAdmin(!!adminRole);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  // Check premium subscription status on load & after redirect
  useEffect(() => {
    if (!user) return;
    const checkPremium = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-premium");
        if (error) throw error;
        if (data?.subscribed && profile && !profile.is_premium) {
          setProfile((prev: any) => prev ? { ...prev, is_premium: true } : prev);
        } else if (!data?.subscribed && profile?.is_premium) {
          setProfile((prev: any) => prev ? { ...prev, is_premium: false } : prev);
        }
      } catch (err) {
        console.error("Failed to check premium:", err);
      }
    };
    checkPremium();
    // Check on return from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      toast.success("Premium activated! Welcome aboard 🎉");
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("premium") === "cancelled") {
      toast.info("Premium checkout cancelled");
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [user, profile?.is_premium]);

  const handleTogglePremium = async () => {
    if (!profile) return;
    if (profile.is_premium) {
      toast.info("You already have Premium! Contact support to manage your subscription.");
      return;
    }
    try {
      toast.loading("Redirecting to checkout...");
      const { data, error } = await supabase.functions.invoke("create-premium-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      toast.dismiss();
    }
  };

  const openAIDialog = (type: "homework" | "tutor", title: string) => {
    setAiDialogType(type);
    setAiDialogTitle(title);
    setAiDialogOpen(true);
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const features = [
    { title: "Past Questions Hub", description: "JAMB, WAEC, NECO & University CBT exam preparation", icon: <GraduationCap className="w-5 h-5" />, badge: "Exams", path: "/past-questions", color: "from-primary/25 to-accent/10" },
    { title: "Tutor Marketplace", description: "Book 1-on-1 and group lessons with verified Nigerian educators", icon: <Users className="w-5 h-5" />, badge: "Live Tutors", path: "/tutors", color: "from-accent/25 to-primary/10" },
    { title: "Live Virtual Classes", description: "Zoom-powered interactive webinars, live Q&A & recorded masterclasses", icon: <Radio className="w-5 h-5" />, badge: "Zoom Powered", path: "/virtual-classes", color: "from-destructive/25 to-primary/10" },
    { title: "STEM Genius AI Chat", description: "Persistent conversational tutor powered by Google Gemini AI", icon: <Brain className="w-5 h-5" />, badge: "Gemini AI", path: "/ai-chat", color: "from-primary/30 to-accent/15" },
    { title: "AI Homework Helper", description: "Snap photos and get step-by-step solutions in any language", icon: <Brain className="w-5 h-5" />, badge: "AI Powered", path: "/ai-homework-helper", color: "from-primary/20 to-primary/5" },
    { title: "Voice STEM Tutor", description: "Ask questions and get voice explanations", icon: <Mic className="w-5 h-5" />, badge: "Voice AI", path: "/voice-stem-tutor", color: "from-chart-3/20 to-chart-3/5" },
    { title: "Challenge Arena", description: "Compete in quizzes and earn rewards", icon: <Lightbulb className="w-5 h-5" />, badge: "Win Prizes", path: "/stem-challenge-arena", color: "from-accent/20 to-accent/5" },
    { title: "AR STEM Labs", description: "Virtual experiments with AR technology", icon: <Atom className="w-5 h-5" />, badge: "AR Tech", path: "/ar-stem-labs", color: "from-chart-4/20 to-chart-4/5" },
    { title: "Story Mode", description: "Learn through interactive African stories", icon: <BookOpen className="w-5 h-5" />, badge: "Cultural", path: "/stem-story-mode", color: "from-chart-5/20 to-chart-5/5" },
    { title: "Career Coach", description: "Get personalized STEM career guidance", icon: <GraduationCap className="w-5 h-5" />, badge: "AI Guidance", path: "/ai-career-coach", color: "from-primary/20 to-chart-2/5" },
    { title: "Marketplace", description: "Buy and sell educational content", icon: <FileText className="w-5 h-5" />, badge: "Earn Money", path: "/marketplace", color: "from-chart-2/20 to-chart-2/5" },
    { title: "STEM Reels", description: "Create and watch educational videos", icon: <Video className="w-5 h-5" />, badge: "Create", path: "/stem-reels", color: "from-destructive/20 to-destructive/5" },
    { title: "Opportunities", description: "STEM events, scholarships & grants", icon: <Briefcase className="w-5 h-5" />, badge: "Discover", path: "/career-opportunities", color: "from-chart-3/20 to-primary/5" },
    { title: "PDF Converter", description: "Convert notes to audio and video", icon: <PlayCircle className="w-5 h-5" />, badge: "Convert", path: "/pdf-converter", color: "from-chart-4/20 to-chart-3/5" },
  ];

  const quickActions = [
    { label: "Past Questions", icon: <GraduationCap className="w-4 h-4" />, path: "/past-questions", accent: true },
    { label: "Find Tutor", icon: <Users className="w-4 h-4" />, path: "/tutors", accent: false },
    { label: "Live Classes", icon: <Radio className="w-4 h-4" />, path: "/virtual-classes", accent: false },
    { label: "AI Chat", icon: <Brain className="w-4 h-4" />, path: "/ai-chat", accent: false },
    { label: "Quick Solver", icon: <Sparkles className="w-4 h-4" />, action: () => openAIDialog("homework", "Quick Problem Solver"), accent: false },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile.name} isPremium={profile.is_premium} onSignOut={handleSignOut} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          
          {/* Hero Banner - Full width immersive */}
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={dashboardHeroImg} 
              alt="STEM Learning Dashboard" 
              className="w-full min-h-[190px] sm:min-h-0 sm:h-48 md:h-56 lg:h-64 object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            
            {/* Animated glow orbs */}
            <div className="absolute top-6 right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse hidden md:block" />
            <div className="absolute bottom-4 right-1/3 w-20 h-20 bg-accent/15 rounded-full blur-2xl animate-pulse hidden md:block" style={{ animationDelay: "1s" }} />
            
            <div className="absolute inset-0 flex items-center py-4">
              <div className="px-4 sm:px-8 max-w-2xl w-full">
                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                  <div className="flex items-center gap-1.5 bg-primary/20 backdrop-blur-sm text-primary text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-primary/20">
                    <Rocket className="w-3 h-3" />
                    Welcome back
                  </div>
                  {stats.streak > 0 && (
                    <div className="flex items-center gap-1.5 bg-accent/20 backdrop-blur-sm text-accent text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-accent/20">
                      <Flame className="w-3 h-3" />
                      {stats.streak} day streak!
                    </div>
                  )}
                </div>
                <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight truncate">
                  Hey, <span className="gradient-text-primary">{profile.name}</span>! 🚀
                </h2>
                <p className="text-xs sm:text-base text-muted-foreground mt-1 sm:mt-2 max-w-lg line-clamp-1 sm:line-clamp-none">
                  Your STEM journey continues. Let's make today count!
                </p>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
                  {quickActions.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={qa.action || (() => navigate(qa.path!))}
                      className={`flex items-center gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-300 min-h-[38px] sm:min-h-[44px] ${
                        qa.accent
                          ? "bg-primary text-primary-foreground hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)] hover:scale-105"
                          : "bg-card/80 backdrop-blur-sm text-foreground border border-border/50 hover:border-primary/30 hover:bg-card"
                      }`}
                    >
                      {qa.icon}
                      <span className="truncate">{qa.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-3">
              <ProgressPanel progress={profile.progress} rank={profile.rank} totalStudents={profile.total_students} />
            </div>

            {/* Main Content */}
            <div className="lg:col-span-9 space-y-8">
              
              {/* Quick Stats - Glassmorphism cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: "Global Rank", value: profile.rank > 0 ? `#${profile.rank}` : "—", icon: <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, glow: "glow-primary" },
                  { label: "Quizzes Done", value: String(stats.quizzes), icon: <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, glow: "" },
                  { label: "Day Streak", value: `${stats.streak}`, icon: <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, glow: stats.streak > 0 ? "glow-accent" : "" },
                  { label: "Status", value: profile.is_premium ? "Premium" : "Free", icon: <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, glow: profile.is_premium ? "glow-accent" : "" },
                ].map((stat, i) => (
                  <div key={i} className={`group relative p-2 sm:p-4 rounded-xl glass-card overflow-hidden transition-all duration-300 hover:scale-[1.02] ${stat.glow}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground mb-1 sm:mb-2">
                        {stat.icon}
                        <p className="text-[9px] sm:text-[11px] font-medium uppercase tracking-wider line-clamp-1">{stat.label}</p>
                      </div>
                      <p className="text-lg sm:text-xl lg:text-2xl font-extrabold text-foreground truncate">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Quiz Section - New Feature Integration */}
              <section className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/95 to-background" />
                <div className="relative p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">🎯 Live Quiz</h2>
                        <p className="text-xs text-muted-foreground">Challenge yourself in real-time multiplayer quizzes</p>
                      </div>
                    </div>
                    <button disabled={!isAdmin}
                      onClick={() => navigate("/live-quiz")}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Explore →
                    </button>
                  </div>
                  <div className="relative">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {/* Create Quiz Card */}
                      <button disabled={!isAdmin}
                        onClick={() => navigate("/live-quiz/create")}
                        className={`relative overflow-hidden rounded-xl p-4 sm:p-6 bg-gradient-to-br from-primary to-primary/70 text-white group transition-all duration-300 min-h-[120px] sm:min-h-auto ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_40px_-12px_hsl(271_91%_65%_/_0.4)]'}`}
                      >
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                        <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/5 rounded-full -mr-12 sm:-mr-16 -mt-12 sm:-mt-16 group-hover:scale-150 transition-transform" />
                        <div className="relative flex flex-col h-full">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="font-bold text-base sm:text-lg">Create Quiz</h3>
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                          </div>
                          <p className="text-white/90 text-xs sm:text-sm line-clamp-2">Build engaging quizzes with multiple input methods</p>
                          <div className="mt-auto flex items-center gap-2 text-white/70 text-xs pt-2 sm:pt-3">
                            <span>→ Start now</span>
                          </div>
                        </div>
                      </button>
                      
                      {/* Join Quiz Card */}
                      <button disabled={!isAdmin}
                        onClick={() => navigate("/live-quiz")}
                        className={`relative overflow-hidden rounded-xl p-4 sm:p-6 bg-gradient-to-br from-accent to-accent/70 text-accent-foreground group transition-all duration-300 min-h-[120px] sm:min-h-auto ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_40px_-12px_hsl(45_100%_60%_/_0.3)]'}`}
                      >
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                        <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/5 rounded-full -mr-12 sm:-mr-16 -mt-12 sm:-mt-16 group-hover:scale-150 transition-transform" />
                        <div className="relative flex flex-col h-full">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="font-bold text-base sm:text-lg">Join Quiz</h3>
                            <Users className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                          </div>
                          <p className="text-accent-foreground/90 text-xs sm:text-sm line-clamp-2">Compete with friends using a simple invite code</p>
                          <div className="mt-auto flex items-center gap-2 text-accent-foreground/70 text-xs pt-2 sm:pt-3">
                            <span>→ Enter code</span>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Coming Soon Overlay for Non-Admins */}
                    {!isAdmin && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3 p-6">
                        <div className="text-center space-y-2">
                          <h3 className="text-xl font-bold text-white">🚀 Coming Soon</h3>
                          <p className="text-white/90 text-sm">The Live Quiz feature is still under development.</p>
                          <p className="text-white/80 text-xs">Normal quiz creation is accessible in the<br /><span className="font-semibold">STEM Challenge Arena</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Challenges Section with background image */}
              <section className="relative rounded-2xl overflow-hidden">
                <img src={challengesBgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
                <div className="relative p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Today's Challenges</h2>
                        <p className="text-xs text-muted-foreground">Complete daily challenges to earn points & climb the ranks</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate("/stem-challenge-arena")}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ChallengeCard title="Math Quick Challenge" description="Test your basic math skills" subject="Math" icon={<Calculator className="w-4 h-4" />} />
                    <ChallengeCard title="Science Basics" description="Fundamental science concepts" subject="Science" icon={<Beaker className="w-4 h-4" />} />
                    <ChallengeCard title="Tech Knowledge" description="Computer and technology basics" subject="Tech" icon={<Cpu className="w-4 h-4" />} />
                  </div>
                </div>
              </section>

              {/* Features Section with background image */}
              <section className="relative rounded-2xl overflow-hidden">
                <img src={featuresBgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/95 to-background" />
                <div className="relative p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Explore Features</h2>
                        <p className="text-xs text-muted-foreground">AI-powered tools to accelerate your STEM learning</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {features.map((f) => {
                      const isComingSoon = f.title === "PDF Converter";
                      const isClickable = !isComingSoon || isAdmin;
                      return (
                        <div 
                          key={f.title} 
                          className="relative"
                          style={{ opacity: !isClickable ? 0.5 : 1, pointerEvents: !isClickable ? 'none' : 'auto' }}
                        >
                          <FeatureCard 
                            title={f.title} 
                            description={f.description} 
                            icon={f.icon} 
                            badge={f.badge} 
                            onClick={() => isClickable && navigate(f.path)}
                          />
                          {isComingSoon && !isAdmin && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-2 p-3 pointer-events-none">
                              <div className="text-center">
                                <p className="text-sm font-bold text-white">🚀 Coming Soon</p>
                                <p className="text-xs text-white/80 mt-1">PDF Converter feature<br />under development</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto">
        <PremiumBanner isPremium={profile.is_premium} onTogglePremium={handleTogglePremium} />
      </footer>

      <AIDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} title={aiDialogTitle} type={aiDialogType} />
    </div>
  );
}
