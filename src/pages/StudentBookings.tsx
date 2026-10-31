import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Calendar, Clock, Video, User, CheckCircle2, AlertCircle,
  Search, ArrowRight, Loader2, Sparkles, BookOpen, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { TutorBooking } from "@/types/tutorMarketplace";
import { fetchUserBookings } from "@/lib/tutorService";

export default function StudentBookings() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<TutorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "completed">("upcoming");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      const [profResult, bookingsList] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        fetchUserBookings(session.user.id, "student"),
      ]);

      setProfile(profResult.data);
      setBookings(bookingsList || []);
      setLoading(false);
    });
  }, [navigate]);

  const filteredBookings = bookings.filter((b) => {
    const tutorName = (b.tutor_profiles as any)?.profiles?.name || "";
    const matchesSearch =
      b.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.topic && b.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "upcoming") {
      return b.status === "scheduled" || b.status === "pending_payment";
    }
    if (activeTab === "completed") {
      return b.status === "completed";
    }
    return true;
  });

  const upcomingCount = bookings.filter(
    (b) => b.status === "scheduled" || b.status === "pending_payment"
  ).length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        userName={profile?.name || "Student"}
        isPremium={profile?.is_premium || false}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <Calendar className="w-7 h-7 text-primary" />
              My Teacher Bookings
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track and join all your booked 1-on-1 tutorials and group lessons.
            </p>
          </div>

          <Button
            onClick={() => navigate("/tutors")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 glow-primary shadow-lg"
          >
            <User className="w-4 h-4" />
            Book a New Teacher
          </Button>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full md:w-auto"
          >
            <TabsList className="bg-secondary/60 border border-border/60">
              <TabsTrigger value="upcoming" className="text-xs">
                Upcoming ({upcomingCount})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                Completed ({completedCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                All Sessions ({bookings.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search subject or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-secondary/40 border-border/60"
            />
          </div>
        </div>

        {/* Content list */}
        {filteredBookings.length === 0 ? (
          <Card className="p-12 glass-card border-border/60 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto text-primary">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">No Bookings Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {activeTab === "upcoming"
                  ? "You have no upcoming tutoring sessions scheduled right now."
                  : activeTab === "completed"
                  ? "You haven't completed any tutoring lessons yet."
                  : "You haven't booked any teacher sessions yet."}
              </p>
            </div>
            <Button
              onClick={() => navigate("/tutors")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
            >
              <User className="w-4 h-4" />
              Explore Qualified Tutors
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => {
              const tutorProfile = b.tutor_profiles as any;
              const tutorName = tutorProfile?.profiles?.name || "Educator";
              const startDate = new Date(b.scheduled_start);
              const formattedDate = startDate.toLocaleDateString("en-NG", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = startDate.toLocaleTimeString("en-NG", {
                hour: "2-digit",
                minute: "2-digit",
              });

              const isPaid = b.payment_status === "paid" || b.is_free;
              const isScheduled = b.status === "scheduled";

              return (
                <Card
                  key={b.id}
                  className="p-5 sm:p-6 glass-card border-border/60 hover:border-primary/40 transition-all duration-200"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* Left: Tutor & Session Details */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-lg text-primary shrink-0 glow-primary">
                        {tutorName.charAt(0)}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-foreground">
                            {b.subject}
                          </h3>
                          {b.topic && (
                            <span className="text-xs text-muted-foreground font-medium">
                              — {b.topic}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              isPaid
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                            }`}
                          >
                            {isPaid ? "Paid & Confirmed" : "Payment Pending"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-primary border-primary/30"
                          >
                            {b.session_format === "one_to_one" ? "1-on-1" : "Group"}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Teacher: <strong className="text-foreground">{tutorName}</strong> • Ref:{" "}
                          <span className="font-mono text-primary/80">{b.booking_reference}</span>
                        </p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {formattedDate}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Clock className="w-3.5 h-3.5 text-accent" />
                            {formattedTime} ({b.duration_minutes} Mins)
                          </span>
                          <span>
                            {b.is_free ? "Complimentary" : `₦${(b.amount_paid || 0).toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/tutoring/booking/${b.id}`)}
                        className="text-xs border-border/60 hover:border-primary/40 gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Session Countdown
                      </Button>

                      {isScheduled && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/tutoring/room/${b.room_id}`)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 glow-primary"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join Classroom
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

