import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, Star, ShieldCheck, CheckCircle2, Clock, Calendar, 
  DollarSign, Award, BookOpen, Video, MessageSquare, Sparkles, Loader2, User
} from "lucide-react";
import { toast } from "sonner";
import { fetchTutorById, createLessonBooking, verifyBookingPayment, fetchTutorReviews, initiateTutorStripeCheckout, verifyTutorBookingAfterCheckout } from "@/lib/tutorService";
import { TutorProfile, TutorReview } from "@/types/tutorMarketplace";

export default function TutorProfileView() {
  const { tutorId } = useParams<{ tutorId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [reviews, setReviews] = useState<TutorReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"one_to_one" | "group">("one_to_one");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("16:00");
  const [duration, setDuration] = useState<number>(60);
  const [studentNotes, setStudentNotes] = useState("");
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data }) => setProfile(data));
      }
    });

    if (tutorId) loadTutor(tutorId);
  }, [tutorId]);

  // Handle returning from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const sessionId = params.get("session_id");

    if (paymentStatus === "success" && sessionId) {
      // Clear URL params without navigation
      window.history.replaceState({}, "", window.location.pathname);
      // Verify with server (webhook is authoritative; this shows user immediate feedback)
      verifyTutorBookingAfterCheckout(sessionId).then(({ confirmed }) => {
        if (confirmed) {
          toast.success("Payment confirmed! Your tutoring session has been booked.");
        } else {
          toast.info("Payment received — your booking will be confirmed shortly.");
        }
      }).catch(() => {
        toast.info("Payment received. We'll confirm your booking via email shortly.");
      });
    } else if (paymentStatus === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      toast.warning("Payment was cancelled. Your booking has not been confirmed.");
    }
  }, []);

  const loadTutor = async (id: string) => {
    try {
      setLoading(true);
      const [tutorData, reviewData] = await Promise.all([
        fetchTutorById(id),
        fetchTutorReviews(id),
      ]);

      if (!tutorData) {
        toast.error("Tutor profile not found");
        navigate("/tutors");
        return;
      }

      setTutor(tutorData);
      setReviews(reviewData);

      if (tutorData.subjects.length > 0) {
        setSelectedSubject(tutorData.subjects[0]);
      }

      // Default tomorrow date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split("T")[0]);
    } catch (err) {
      console.error("Error loading tutor:", err);
      toast.error("Failed to load tutor profile");
    } finally {
      setLoading(false);
    }
  };

  const handleBookSession = async () => {
    if (!user) {
      toast.error("Please login to book a lesson");
      navigate("/auth");
      return;
    }
    if (!tutor) return;

    if (!selectedSubject) {
      toast.error("Please select a subject");
      return;
    }

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    if (scheduledDateTime.getTime() < Date.now()) {
      toast.error("Please select a future date and time");
      return;
    }

    setIsProcessingBooking(true);
    try {
      const isFree = tutor.offers_free_sessions && tutor.hourly_rate === 0;

      const booking = await createLessonBooking({
        tutorId: tutor.id,
        studentId: user.id,
        subject: selectedSubject,
        topic: selectedTopic || undefined,
        sessionFormat: selectedFormat,
        isFree,
        scheduledStart: scheduledDateTime.toISOString(),
        durationMinutes: duration,
        hourlyRate: tutor.hourly_rate,
        studentNotes,
      });

      if (!booking) throw new Error("Failed to create booking");

      if (isFree) {
        toast.success("Lesson booked successfully!");
        setBookingOpen(false);
        navigate(`/tutoring/booking/${booking.id}`);
      } else {
        // Initiate real Stripe Checkout for paid sessions
        toast.loading("Redirecting to secure payment...");
        const checkout = await initiateTutorStripeCheckout(booking.id);
        toast.dismiss();
        if (checkout?.url) {
          // Full page redirect to Stripe — webhook confirms payment on return
          window.location.href = checkout.url;
        } else {
          throw new Error("Payment service did not return a checkout URL");
        }
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to complete booking");
    } finally {
      setIsProcessingBooking(false);
    }
  };

  if (loading || !tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading tutor profile...</p>
        </div>
      </div>
    );
  }

  const calculatedCost = tutor.offers_free_sessions && tutor.hourly_rate === 0
    ? 0
    : Math.round((tutor.hourly_rate * duration) / 60);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile?.name || "Student"} isPremium={profile?.is_premium || false} onSignOut={() => supabase.auth.signOut()} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tutors")}
            className="gap-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tutor Directory
          </Button>

          {/* Profile Overview Card */}
          <Card className="p-6 sm:p-8 glass-card border-border/80 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-bold text-2xl text-primary shrink-0 glow-primary">
                  {tutor.profiles?.name?.charAt(0) || "T"}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                      {tutor.profiles?.name || "Educator"}
                    </h1>
                    <ShieldCheck className="w-5 h-5 text-primary" title="Verified Qualifications" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    {tutor.experience_years} years experience • {tutor.total_sessions_completed} sessions taught
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex items-center gap-1 bg-accent/15 px-2.5 py-0.5 rounded-full border border-accent/20">
                      <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                      <span className="text-xs font-bold text-accent">
                        {tutor.rating_average > 0 ? tutor.rating_average : "5.0"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">({tutor.total_reviews} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Pricing & Booking CTA */}
              <div className="flex flex-col items-start md:items-end gap-2 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-border/40">
                <div className="text-left md:text-right">
                  {tutor.offers_free_sessions && tutor.hourly_rate === 0 ? (
                    <Badge className="bg-accent/20 text-accent border-accent/30 text-xs font-bold">
                      FREE COMMUNITY TUTOR
                    </Badge>
                  ) : (
                    <div>
                      <span className="text-2xl font-extrabold text-foreground">
                        ₦{tutor.hourly_rate.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">/hour</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => setBookingOpen(true)}
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 text-xs h-10 gap-2 shadow-lg glow-primary"
                >
                  <Calendar className="w-4 h-4" />
                  Book Online Session
                </Button>
              </div>
            </div>

            {/* Headline */}
            <div className="mt-6 pt-6 border-t border-border/40">
              <h2 className="text-sm font-semibold text-foreground/90 leading-relaxed">
                "{tutor.headline}"
              </h2>
            </div>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left 2 Cols: Bio, Qualifications, Subjects */}
            <div className="md:col-span-2 space-y-6">
              {/* About & Philosophy */}
              <Card className="p-6 glass-card border-border/60 space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  About the Tutor & Teaching Approach
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {tutor.bio}
                </p>
                {tutor.teaching_philosophy && (
                  <div className="mt-3 p-3 rounded-xl bg-secondary/40 border border-primary/20 space-y-1">
                    <span className="text-[11px] font-bold text-primary uppercase block">
                      Teaching Philosophy:
                    </span>
                    <p className="text-xs text-foreground/90 italic">
                      "{tutor.teaching_philosophy}"
                    </p>
                  </div>
                )}
              </Card>

              {/* Verified Qualifications */}
              <Card className="p-6 glass-card border-border/60 space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  Educational Credentials & Qualifications
                </h3>
                {tutor.qualifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Academic credentials verified by STEM Genius staff.</p>
                ) : (
                  <div className="space-y-2.5">
                    {tutor.qualifications.map((q, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-xs text-foreground">{q.title}</p>
                          <p className="text-[11px] text-muted-foreground">{q.institution} ({q.year})</p>
                        </div>
                        {q.is_verified && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Student Reviews */}
              <Card className="p-6 glass-card border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-chart-3" />
                    Student Reviews ({reviews.length})
                  </h3>
                </div>

                {reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No reviews yet. Be the first student to review this tutor after your lesson!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="p-3.5 rounded-lg bg-secondary/30 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            {rev.student?.name || "Student"}
                          </span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: rev.rating }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-accent fill-accent" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{rev.review_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Subjects, Availability Schedule */}
            <div className="space-y-6">
              {/* Subjects & Exam Focus */}
              <Card className="p-5 glass-card border-border/60 space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Subjects Taught
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {tutor.subjects.map((sub) => (
                    <Badge key={sub} variant="secondary" className="text-xs">
                      {sub}
                    </Badge>
                  ))}
                </div>

                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground pt-2">
                  Exam Focus
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {tutor.exam_types.map((ex) => (
                    <Badge key={ex} variant="outline" className="text-xs text-primary border-primary/30">
                      {ex}
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* Weekly Availability */}
              <Card className="p-5 glass-card border-border/60 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  Weekly Availability
                </h4>
                <div className="space-y-2 text-xs">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((dayName, idx) => {
                    const slot = tutor.tutor_availability?.find((a) => a.day_of_week === idx && a.is_active);
                    return (
                      <div key={dayName} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                        <span className="text-muted-foreground">{dayName}</span>
                        {slot ? (
                          <span className="font-mono text-primary font-medium">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* BOOKING MODAL */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Book Tutoring Session
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Direct interactive lesson with {tutor.profiles?.name} in the STEM Genius Virtual Classroom.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Select Subject *
              </label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="bg-secondary/40 text-xs">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {tutor.subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Specific Topic / Problem (Optional)
              </label>
              <Input
                placeholder="e.g. Calculus Integration, WAEC 2023 Physics Question 4"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Session Date *
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Time Slot *
                </label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="16:00">04:00 PM</SelectItem>
                    <SelectItem value="18:00">06:00 PM</SelectItem>
                    <SelectItem value="20:00">08:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Duration
              </label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger className="bg-secondary/40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Minutes</SelectItem>
                  <SelectItem value="60">60 Minutes (Standard)</SelectItem>
                  <SelectItem value="90">90 Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Total Price Calculation Card */}
            <div className="p-3.5 rounded-xl bg-secondary/50 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">Total Amount</span>
                <span className="text-lg font-extrabold text-foreground">
                  {calculatedCost === 0 ? "FREE" : `₦${calculatedCost.toLocaleString()}`}
                </span>
              </div>
              <Badge variant="outline" className="text-xs text-primary border-primary/40">
                {duration} Mins Session
              </Badge>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBookingOpen(false)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBookSession}
              disabled={isProcessingBooking}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5"
            >
              {isProcessingBooking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {calculatedCost === 0 ? "Confirm Free Booking" : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

