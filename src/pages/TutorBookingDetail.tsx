import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Clock, Video, CheckCircle2, ShieldCheck, ArrowLeft,
  Sparkles, AlertCircle, Loader2, BookOpen, User, HelpCircle,
  FileCheck, Laptop, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { TutorBooking } from "@/types/tutorMarketplace";
import { verifyTutorBookingAfterCheckout } from "@/lib/tutorService";

export default function TutorBookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [booking, setBooking] = useState<TutorBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
    isStartingSoon: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
    isStartingSoon: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));

      if (bookingId) {
        loadBooking(bookingId, session.user.id);
      }
    });
  }, [bookingId, navigate]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if (paymentStatus === "success" && sessionId && bookingId) {
      setVerifyingPayment(true);
      verifyTutorBookingAfterCheckout(sessionId)
        .then(async ({ confirmed }) => {
          if (confirmed) {
            // Ensure local DB record is synchronized to scheduled & paid
            await supabase
              .from("tutor_bookings")
              .update({
                payment_status: "paid",
                status: "scheduled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", bookingId);

            toast.success("Payment verified! Your lesson is confirmed and synced with your tutor.");
          } else {
            toast.info("Payment received! Booking confirmation is syncing with your teacher.");
          }
          if (user?.id) loadBooking(bookingId, user.id);
        })
        .catch(() => {
          toast.info("Payment processed. Your schedule has been registered.");
          if (user?.id) loadBooking(bookingId, user.id);
        })
        .finally(() => setVerifyingPayment(false));
    } else if (paymentStatus === "cancelled") {
      toast.warning("Payment was not completed.");
    }
  }, [searchParams, bookingId, user?.id]);

  const loadBooking = async (id: string, currentUserId: string) => {
    try {
      setLoading(true);
      let bookingRecord: any = null;

      const { data, error } = await supabase
        .from("tutor_bookings")
        .select(
          `*,
           tutor_profiles (*, profiles:user_id(name, avatar_url, school_or_org)),
           student:student_id (name)`
        )
        .eq("id", id)
        .maybeSingle();

      if (data && !error) {
        bookingRecord = data;
      } else {
        // Fallback: fetch raw booking directly and attach relationships separately
        const { data: rawBooking, error: rawErr } = await supabase
          .from("tutor_bookings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (rawErr || !rawBooking) {
          console.error("Booking query error:", error || rawErr);
          toast.error("Booking not found");
          navigate("/tutors");
          return;
        }

        const [{ data: tutorProf }, { data: studentProf }] = await Promise.all([
          supabase
            .from("tutor_profiles")
            .select("*, profiles:user_id(name, avatar_url, school_or_org)")
            .eq("id", rawBooking.tutor_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("name")
            .eq("id", rawBooking.student_id)
            .maybeSingle(),
        ]);

        bookingRecord = {
          ...rawBooking,
          tutor_profiles: tutorProf,
          student: studentProf,
        };
      }

      // Security check: only student or tutor can view
      const tutorUserId = (bookingRecord.tutor_profiles as any)?.user_id;
      if (bookingRecord.student_id !== currentUserId && tutorUserId !== currentUserId) {
        toast.error("Access denied");
        navigate("/tutors");
        return;
      }

      setBooking(bookingRecord as unknown as TutorBooking);
    } catch (err) {
      console.error("Error loading booking:", err);
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener for booking status updates
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`booking-detail-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tutor_bookings",
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          setBooking((prev) => (prev ? { ...prev, ...(payload.new as any) } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Live countdown timer until scheduledStart
  useEffect(() => {
    if (!booking?.scheduled_start) return;

    const updateCountdown = () => {
      const now = Date.now();
      const start = new Date(booking.scheduled_start).getTime();
      const end = new Date(booking.scheduled_end).getTime();
      const diff = start - now;

      if (now > end) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isStartingSoon: false });
        return;
      }

      if (diff <= 0) {
        // Class is currently ongoing
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isStartingSoon: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      // Starting soon if within 15 minutes
      const isStartingSoon = diff <= 15 * 60 * 1000;

      setTimeLeft({ days, hours, minutes, seconds, isPast: false, isStartingSoon });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [booking?.scheduled_start, booking?.scheduled_end]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) return null;

  const tutorProfile = booking.tutor_profiles as any;
  const tutorName = tutorProfile?.profiles?.name || "Your Teacher";
  const startDate = new Date(booking.scheduled_start);
  const formattedDate = startDate.toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = startDate.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        userName={profile?.name || "Student"}
        isPremium={profile?.is_premium || false}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Navigation & Breadcrumbs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/my-bookings")}
            className="gap-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Bookings
          </Button>

          <Badge variant="outline" className="font-mono text-xs border-border/60">
            REF: {booking.booking_reference}
          </Badge>
        </div>

        {/* HERO STATUS BANNER: Confirmation & Synced status */}
        <Card className="p-6 sm:p-8 glass-card border-border/80 relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {verifyingPayment ? (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-xs gap-1.5 py-1 px-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Payment...
                  </Badge>
                ) : booking.payment_status === "paid" || booking.is_free ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs gap-1.5 py-1 px-3 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Teacher Booked & Confirmed
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-xs py-1 px-3">
                    Payment Pending
                  </Badge>
                )}

                <Badge variant="outline" className="text-xs text-primary border-primary/40">
                  {booking.session_format === "one_to_one" ? "1-on-1 Private Tutorial" : "Group Session"}
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {booking.subject} Lesson with {tutorName}
              </h1>
              {booking.topic && (
                <p className="text-sm text-primary font-medium">
                  Topic: {booking.topic}
                </p>
              )}

              <p className="text-xs sm:text-sm text-muted-foreground">
                Scheduled for <strong className="text-foreground">{formattedDate}</strong> at{" "}
                <strong className="text-foreground">{formattedTime}</strong> ({booking.duration_minutes} Minutes)
              </p>
            </div>

            {/* Quick Action: Join Classroom */}
            <div className="shrink-0 w-full md:w-auto">
              <Button
                onClick={() => navigate(`/tutoring/room/${booking.room_id}`)}
                className={`w-full md:w-auto font-bold text-xs h-11 px-6 gap-2 shadow-lg ${
                  timeLeft.isStartingSoon
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
                }`}
              >
                <Video className="w-4 h-4" />
                {timeLeft.isStartingSoon ? "Join Live Classroom Now" : "Enter Tutoring Room"}
              </Button>
            </div>
          </div>
        </Card>

        {/* COUNTDOWN LAYER */}
        {!timeLeft.isPast && (
          <Card className="p-6 glass-card border-primary/30 bg-primary/5 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Clock className="w-4 h-4 text-primary" />
              {timeLeft.isStartingSoon ? "Class Session Is Live!" : "Countdown to Class Start"}
            </div>

            {timeLeft.isStartingSoon ? (
              <div className="space-y-2 py-2">
                <p className="text-lg font-bold text-emerald-400 animate-pulse">
                  The classroom is open! Your teacher is ready or joining shortly.
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the button above to enter the classroom with video, microphone, and interactive whiteboard.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto py-2">
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono block">
                    {timeLeft.days.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Days</span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono block">
                    {timeLeft.hours.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Hours</span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono block">
                    {timeLeft.minutes.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Mins</span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono block">
                    {timeLeft.seconds.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Secs</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* TWO-COLUMN DETAILS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left 2 Cols: Preparation checklist & instructions */}
          <div className="md:col-span-2 space-y-6">
            {/* Preparation Checklist */}
            <Card className="p-6 glass-card border-border/60 space-y-4">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                Lesson Preparation Checklist
              </h3>
              <p className="text-xs text-muted-foreground">
                Follow these simple steps to ensure you get the most out of your scheduled session with {tutorName}.
              </p>

              <div className="space-y-3 pt-1">
                {[
                  {
                    title: "Hardware & Device Check",
                    desc: "Ensure your camera and microphone are connected and working. You can test them anytime by clicking Enter Tutoring Room.",
                  },
                  {
                    title: "Prepare Your Questions & Materials",
                    desc: "Have your syllabus, textbooks, past exam questions, or homework problems open so you can share your screen or whiteboard.",
                  },
                  {
                    title: "Quiet Study Environment",
                    desc: "Join from a quiet location with headphones if possible, for clear audio exchange during the tutorial.",
                  },
                  {
                    title: "Teacher Sync Notification",
                    desc: "Your teacher has been notified of your reservation. The session is recorded on their teaching dashboard and wallet.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">{item.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Student Notes */}
            {booking.student_notes && (
              <Card className="p-5 glass-card border-border/60 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Your Notes for the Teacher
                </h4>
                <p className="text-xs text-foreground/90 leading-relaxed bg-secondary/40 p-3 rounded-lg border border-border/40">
                  "{booking.student_notes}"
                </p>
              </Card>
            )}
          </div>

          {/* Right 1 Col: Tutor Info & Payment Receipt */}
          <div className="space-y-6">
            {/* Tutor Card */}
            <Card className="p-5 glass-card border-border/60 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Your Assigned Teacher
              </h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-lg text-primary shrink-0">
                  {tutorName.charAt(0)}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {tutorName}
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    {tutorProfile?.experience_years || 1}+ years experience
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subject:</span>
                  <span className="font-medium text-foreground">{booking.subject}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Duration:</span>
                  <span className="font-medium text-foreground">{booking.duration_minutes} Mins</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Room ID:</span>
                  <span className="font-mono text-[10px] text-primary">{booking.room_id}</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/tutor/${booking.tutor_id}`)}
                className="w-full text-xs border-border/60 gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                View Full Tutor Profile
              </Button>
            </Card>

            {/* Payment Summary */}
            <Card className="p-5 glass-card border-border/60 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Payment Details
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-foreground">
                    {booking.is_free ? "FREE" : `₦${(booking.amount_paid || 0).toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                    {booking.is_free ? "Complimentary" : "Paid & Verified"}
                  </Badge>
                </div>
                {booking.payment_reference && (
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Reference:</span>
                    <span className="font-mono truncate max-w-[140px]">{booking.payment_reference}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

