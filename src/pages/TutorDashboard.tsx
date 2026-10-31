import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  GraduationCap, Calendar, DollarSign, Clock, Star, Video, 
  ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, Building2, 
  Send, Users, BookOpen, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { 
  checkUserTutorStatus, 
  fetchUserBookings, 
  fetchTutorWallet, 
  updateTutorBankDetails, 
  fetchTutorReviews 
} from "@/lib/tutorService";
import { TutorProfile, TutorBooking, TutorWallet, TutorReview } from "@/types/tutorMarketplace";

export default function TutorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [bookings, setBookings] = useState<TutorBooking[]>([]);
  const [wallet, setWallet] = useState<TutorWallet | null>(null);
  const [reviews, setReviews] = useState<TutorReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Bank update modal
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isUpdatingBank, setIsUpdatingBank] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      loadTutorData(session.user.id);
    });
  }, [navigate]);

  const loadTutorData = async (userId: string) => {
    try {
      setLoading(true);
      const [profileRes, tutorData] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        checkUserTutorStatus(userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      if (!tutorData || tutorData.verification_status !== "verified") {
        toast.error("You need an approved tutor account to view this dashboard");
        navigate("/tutors");
        return;
      }

      setTutor(tutorData);

      const [bookingsData, walletData, reviewsData] = await Promise.all([
        fetchUserBookings(userId, "tutor"),
        fetchTutorWallet(tutorData.id),
        fetchTutorReviews(tutorData.id),
      ]);

      setBookings(bookingsData);
      setWallet(walletData);
      setReviews(reviewsData);

      if (walletData) {
        setBankName(walletData.bank_name || "");
        setAccountNumber(walletData.account_number || "");
        setAccountName(walletData.account_name || "");
      }
    } catch (err) {
      console.error("Error loading tutor dashboard:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async () => {
    if (!tutor || !accountNumber.trim() || !bankName.trim() || !accountName.trim()) {
      toast.error("Please fill in all bank details");
      return;
    }

    setIsUpdatingBank(true);
    try {
      await updateTutorBankDetails(tutor.id, {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      toast.success("Bank details saved for automated payouts!");
      setBankModalOpen(false);
      const updatedWallet = await fetchTutorWallet(tutor.id);
      setWallet(updatedWallet);
    } catch (err: any) {
      toast.error(err.message || "Failed to update bank details");
    } finally {
      setIsUpdatingBank(false);
    }
  };

  if (loading || !tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your Tutor Portal...</p>
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter((b) => b.status === "scheduled");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile?.name || "Tutor"} isPremium={profile?.is_premium || false} onSignOut={() => supabase.auth.signOut()} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Top Banner */}
          <div className="glass-card p-6 sm:p-8 rounded-2xl border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Verified STEM Tutor
                </Badge>
                <span className="text-xs text-muted-foreground">Rating: {tutor.rating_average} ★</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                Tutor Command Center
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your scheduled lessons, student attendance, wallet payouts, and feedback.
              </p>
            </div>

            <Button
              onClick={() => navigate("/tutors")}
              variant="outline"
              className="text-xs border-border/60 gap-1.5"
            >
              <Users className="w-4 h-4 text-primary" />
              Public Directory
            </Button>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 glass-card border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Available Balance</span>
              <p className="text-2xl font-extrabold text-accent">
                ₦{wallet?.available_balance ? Number(wallet.available_balance).toLocaleString() : "0"}
              </p>
              <span className="text-[10px] text-muted-foreground">Ready for withdrawal</span>
            </Card>

            <Card className="p-4 glass-card border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Pending Clearance</span>
              <p className="text-2xl font-extrabold text-foreground">
                ₦{wallet?.pending_balance ? Number(wallet.pending_balance).toLocaleString() : "0"}
              </p>
              <span className="text-[10px] text-muted-foreground">Clears upon lesson completion</span>
            </Card>

            <Card className="p-4 glass-card border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Lessons Taught</span>
              <p className="text-2xl font-extrabold text-primary">
                {tutor.total_sessions_completed}
              </p>
              <span className="text-[10px] text-muted-foreground">{upcomingBookings.length} upcoming</span>
            </Card>

            <Card className="p-4 glass-card border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Hourly Rate</span>
              <p className="text-2xl font-extrabold text-foreground">
                ₦{tutor.hourly_rate.toLocaleString()}
              </p>
              <span className="text-[10px] text-muted-foreground">Per 60 minutes</span>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="bookings" className="space-y-6">
            <TabsList className="bg-secondary/60 p-1 border border-border/50">
              <TabsTrigger value="bookings" className="gap-2">
                <Calendar className="w-4 h-4" />
                Scheduled Lessons ({upcomingBookings.length})
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Wallet & Payouts
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2">
                <Star className="w-4 h-4" />
                Student Reviews ({reviews.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SCHEDULED LESSONS */}
            <TabsContent value="bookings" className="space-y-4">
              {bookings.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Bookings Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    When students book lessons from your profile, they will appear here with one-click entry to the tutoring room.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <Card
                      key={b.id}
                      className="p-5 glass-card border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{b.subject}</span>
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                            {b.session_format === "group" ? "Group" : "1-on-1"}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              b.status === "scheduled"
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {b.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Student: <span className="font-semibold text-foreground">{b.student?.name || "Student"}</span> • Ref: {b.booking_reference}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Time: {new Date(b.scheduled_start).toLocaleString()} ({b.duration_minutes} mins)
                        </p>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-accent">
                            {b.is_free ? "FREE" : `₦${b.tutor_earnings.toLocaleString()}`}
                          </span>
                          <p className="text-[10px] text-muted-foreground">Your Net Earnings</p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate(`/tutoring/room/${b.room_id}`)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5"
                        >
                          <Video className="w-4 h-4" />
                          Enter Tutoring Room
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: WALLET & PAYOUTS */}
            <TabsContent value="payouts" className="space-y-6">
              <Card className="p-6 glass-card border-border/60 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Bank Account Details for Automated Payouts
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBankModalOpen(true)}
                    className="text-xs border-border/60"
                  >
                    Edit Bank Info
                  </Button>
                </div>

                {wallet?.account_number ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">Bank Name</span>
                      <p className="text-xs font-bold text-foreground mt-0.5">{wallet.bank_name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">Account Number</span>
                      <p className="text-xs font-bold font-mono text-foreground mt-0.5">{wallet.account_number}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">Account Name</span>
                      <p className="text-xs font-bold text-foreground mt-0.5">{wallet.account_name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-xl bg-secondary/20 border border-border/40 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No bank details configured. Add your Nigerian bank account to receive automated lesson payouts.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setBankModalOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                      Add Bank Account
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* TAB 3: REVIEWS */}
            <TabsContent value="reviews" className="space-y-4">
              {reviews.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Student Reviews Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Student feedback from completed tutoring sessions will appear here.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviews.map((rev) => (
                    <Card key={rev.id} className="p-4 glass-card border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {rev.student?.name || "Student"}
                        </span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-accent fill-accent" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{rev.review_text}</p>
                      <span className="text-[10px] text-muted-foreground/60 block pt-1">
                        {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* BANK DETAILS MODAL */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Configure Payout Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Funds are automatically settled to this Nigerian bank account via Paystack Transfer API.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Bank Name *
              </label>
              <Input
                placeholder="e.g. GTBank, Access Bank, Zenith Bank, Kuda"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Account Number (10 Digits) *
              </label>
              <Input
                placeholder="0123456789"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="bg-secondary/40 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Account Name *
              </label>
              <Input
                placeholder="Exact name matching your bank account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBankModalOpen(false)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBank}
              disabled={isUpdatingBank}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5"
            >
              {isUpdatingBank && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Bank Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

