import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  GraduationCap, Bell, Sparkles, ShoppingCart, Crown, User, ShieldCheck, 
  Search, Menu, X, Gamepad2, BookOpen, Users, Video, Calendar, Brain 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  userName: string;
  isPremium: boolean;
  onSignOut: () => void;
}

export function Header({ userName, isPremium, onSignOut }: HeaderProps) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle()
          .then(({ data }) => setIsAdmin(!!data));
      }
    });
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Brand */}
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate("/dashboard")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary shrink-0">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-foreground">
            STEM Genius
          </span>
        </div>

        {/* Main Nav Links */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-primary hover:bg-primary/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/past-questions")}
            title="Past Questions & Exam Hub"
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">Past Questions</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-accent hover:bg-accent/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/tutors")}
            title="Tutor Marketplace"
          >
            <Users className="w-3.5 h-3.5 text-accent" />
            <span className="hidden md:inline">Find Tutor</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-primary hover:bg-primary/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/my-bookings")}
            title="My Booked Tutoring Sessions"
          >
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="hidden lg:inline">My Bookings</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-primary hover:bg-primary/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/virtual-classes")}
            title="Live Classes & Webinars"
          >
            <Video className="w-3.5 h-3.5 text-destructive" />
            <span className="hidden xl:inline">Live Classes</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-primary hover:bg-primary/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/ai-chat")}
            title="STEM Genius AI Conversational Chat"
          >
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="hidden xl:inline">AI Chat</span>
          </Button>
          {/* <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground hover:text-primary hover:bg-primary/10 h-8 px-2.5 text-xs font-semibold"
            onClick={() => navigate("/about")}
            title="About STEM Genius & Founders"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="hidden xl:inline">About</span>
          </Button> */}


          {isPremium && (
            <Badge className="gap-1 bg-accent/15 text-accent border-accent/20 hover:bg-accent/20 h-6 text-[10px] font-semibold">
              <Crown className="w-2.5 h-2.5" />
              PRO
            </Badge>
          )}

          <Button disabled
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            onClick={() => navigate("/live-quiz")}
            title="Live Quiz"
          >
            <Gamepad2 className="w-4 h-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden xs:inline-flex"
            onClick={() => navigate("/my-profile")}
            title="My Profile"
          >
            <User className="w-4 h-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/notifications")}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            onClick={() => navigate("/cart")}
            title="Cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>

          <div className="hidden sm:block w-px h-5 bg-border mx-1" />

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSignOut} 
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
          >
            Sign Out
          </Button>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden h-8 w-8 ml-1 text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile menu overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-background/95 backdrop-blur-md" onClick={() => setMobileOpen(false)} />
            <div className="relative p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">STEM Genius</h1>
                    <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Welcome, {userName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-1.5 bg-black rounded-lg">
                                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/about'); setMobileOpen(false); }}>
                  <Sparkles className="w-4 h-4 mr-2 text-primary" /> About Us
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/past-questions'); setMobileOpen(false); }}>
                  <BookOpen className="w-4 h-4 mr-2 text-primary" /> Past Questions
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/tutors'); setMobileOpen(false); }}>
                  <Users className="w-4 h-4 mr-2 text-accent" /> Find Tutor
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/my-bookings'); setMobileOpen(false); }}>
                  <Calendar className="w-4 h-4 mr-2 text-primary" /> My Bookings
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/virtual-classes'); setMobileOpen(false); }}>
                  <Video className="w-4 h-4 mr-2 text-destructive" /> Live Classes
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/ai-chat'); setMobileOpen(false); }}>
                  <Brain className="w-4 h-4 mr-2 text-primary" /> AI Chat
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/my-profile'); setMobileOpen(false); }}>
                  <User className="w-4 h-4 mr-2" /> My Profile
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/notifications'); setMobileOpen(false); }}>
                  <Bell className="w-4 h-4 mr-2" /> Notifications
                </Button>
                <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/cart'); setMobileOpen(false); }}>
                  <ShoppingCart className="w-4 h-4 mr-2" /> Cart
                </Button>
                {isAdmin && (
                  <Button variant="ghost" className="justify-start text-xs" onClick={() => { navigate('/admin'); setMobileOpen(false); }}>
                    <ShieldCheck className="w-4 h-4 mr-2 text-primary" /> Admin Portal
                  </Button>
                )}
              </div>

              <div className="pt-3 border-t border-border/50">
                <Button variant="outline" className="w-full text-xs" onClick={() => { onSignOut(); setMobileOpen(false); }}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
