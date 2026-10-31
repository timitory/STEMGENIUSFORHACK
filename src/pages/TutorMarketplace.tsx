import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, Search, Star, ShieldCheck, CheckCircle2, Clock, 
  Sparkles, Calendar, DollarSign, Award, ChevronRight, UserPlus, 
  Filter, GraduationCap, Video, BookOpen, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { fetchTutors, checkUserTutorStatus, submitTutorApplication } from "@/lib/tutorService";
import { TutorProfile } from "@/types/tutorMarketplace";
import SUBJECTED from "./Subjects";

export default function TutorMarketplace() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Directory state
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedExamType, setSelectedExamType] = useState<string>("all");
  const [filterFreeOnly, setFilterFreeOnly] = useState(false);
  const [userTutorProfile, setUserTutorProfile] = useState<TutorProfile | null>(null);

  // Application Modal state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [appHeadline, setAppHeadline] = useState("");
  const [appBio, setAppBio] = useState("");
  const [appPhilosophy, setAppPhilosophy] = useState("");
  const [appSubjects, setAppSubjects] = useState<string[]>([]);
  const [appYears, setAppYears] = useState<number>(3);
  const [appHourlyRate, setAppHourlyRate] = useState<number>(3500);
  const [appOffersFree, setAppOffersFree] = useState(true);
  const [appDegree, setAppDegree] = useState("");
  const [appInstitution, setAppInstitution] = useState("");
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      loadData(session.user.id);
    });
  }, [navigate]);

  const loadData = async (userId: string) => {
    try {
      setLoading(true);
      const [profileRes, tutorsList, tutorStatus] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        fetchTutors(),
        checkUserTutorStatus(userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setTutors(tutorsList);
      setUserTutorProfile(tutorStatus);
    } catch (err) {
      console.error("Error loading tutor marketplace:", err);
      toast.error("Failed to load tutors");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySubmit = async () => {
    if (!appHeadline.trim() || !appBio.trim() || appSubjects.length === 0) {
      toast.error("Please fill in headline, bio, and select at least one subject");
      return;
    }

    setIsSubmittingApp(true);
    try {
      const qualifications = appDegree.trim()
        ? [
            {
              title: appDegree.trim(),
              institution: appInstitution.trim() || "University",
              year: 2022,
              is_verified: false,
            },
          ]
        : [];

      await submitTutorApplication(user.id, {
        headline: appHeadline.trim(),
        bio: appBio.trim(),
        teaching_philosophy: appPhilosophy.trim() || undefined,
        qualifications,
        experience_years: appYears,
        subjects: appSubjects,
        hourly_rate: appOffersFree ? 0 : appHourlyRate,
        offers_free_sessions: appOffersFree,
        teaching_formats: ["one_to_one", "group"],
      });

      toast.success("Tutor application submitted! An administrator will review your credentials.");
      setApplyModalOpen(false);
      const updatedStatus = await checkUserTutorStatus(user.id);
      setUserTutorProfile(updatedStatus);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handleSubjectToggle = (subj: string) => {
    if (appSubjects.includes(subj)) {
      setAppSubjects(appSubjects.filter((s) => s !== subj));
    } else {
      if (appSubjects.length >= 5) {
        toast.info("You can select up to 5 primary subjects");
        return;
      }
      setAppSubjects([...appSubjects, subj]);
    }
  };

  const filteredTutors = tutors.filter((t) => {
    const matchSearch =
      searchQuery === "" ||
      t.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subjects.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchSubject =
      selectedSubject === "all" || t.subjects.includes(selectedSubject);

    const matchExam =
      selectedExamType === "all" || t.exam_types.includes(selectedExamType);

    const matchFree = !filterFreeOnly || t.offers_free_sessions;

    return matchSearch && matchSubject && matchExam && matchFree;
  });

  const popularSubjects = [
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "English Language",
    "Computer Science",
    "Calculus",
  ];

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading STEM Genius Tutor Marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile.name} isPremium={profile.is_premium} onSignOut={() => supabase.auth.signOut()} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden glass-card p-4 sm:p-8 border border-border/60">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 border border-accent/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live 1-on-1 & Group Tutoring Marketplace
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                  Learn from <span className="gradient-text-accent">Verified STEM Educators</span>
                </h1>
                <p className="text-xs sm:text-base text-muted-foreground mt-1.5 sm:mt-2 leading-relaxed">
                  Book one-on-one and group tutorials for WAEC, JAMB, Post-UTME, and university degree courses. Free introductory sessions and affordable hourly lessons held directly inside STEM Genius.
                </p>
              </div>

              {/* Tutor & Student Action Buttons */}
              <div className="shrink-0 flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  onClick={() => navigate("/my-bookings")}
                  className="w-full md:w-auto border-border/60 text-xs font-semibold gap-2"
                >
                  <Calendar className="w-4 h-4 text-primary" />
                  My Booked Lessons
                </Button>

                {userTutorProfile?.verification_status === "verified" ? (
                  <Button
                    onClick={() => navigate("/tutor/dashboard")}
                    className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 glow-primary"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Open Tutor Dashboard
                  </Button>
                ) : userTutorProfile?.verification_status === "pending" ? (
                  <Badge variant="outline" className="text-xs p-2.5 text-accent border-accent/30 flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin text-accent" />
                    Tutor Application Under Review
                  </Badge>
                ) : (
                  <Button
                    onClick={() => setApplyModalOpen(true)}
                    className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-bold gap-2 glow-accent shadow-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    Become a Tutor
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Earn up to ₦150,000+/month teaching on your schedule
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <Card className="p-4 sm:p-5 glass-card border-border/60 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tutors by name, subject (e.g. Calculus, Physics), or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 text-xs bg-secondary/50 border-border/50"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="col-span-1 sm:w-auto">
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-full sm:w-44 h-10 text-xs bg-secondary/50 border-border/50">
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">All Subjects</SelectItem>
                      {popularSubjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1 sm:w-auto">
                  <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                    <SelectTrigger className="w-full sm:w-36 h-10 text-xs bg-secondary/50 border-border/50">
                      <SelectValue placeholder="All Exams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exams</SelectItem>
                      <SelectItem value="JAMB">JAMB / UTME</SelectItem>
                      <SelectItem value="WAEC">WAEC (WASSCE)</SelectItem>
                      <SelectItem value="NECO">NECO</SelectItem>
                      <SelectItem value="POST_UTME">Post-UTME</SelectItem>
                      <SelectItem value="UNIVERSITY">University Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 sm:w-auto">
                  <Button
                    variant={filterFreeOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterFreeOnly(!filterFreeOnly)}
                    className={`w-full sm:w-auto h-10 text-xs border-border/50 ${filterFreeOnly ? "bg-accent text-accent-foreground font-bold" : ""}`}
                  >
                    Free Sessions Only
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Topic Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
              <span className="text-muted-foreground text-[11px] font-semibold shrink-0">Popular:</span>
              {popularSubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSubject(selectedSubject === s ? "all" : s)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors shrink-0 ${
                    selectedSubject === s
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          {/* Tutor Directory Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">
                Available STEM Tutors ({filteredTutors.length})
              </h2>
              <span className="text-xs text-muted-foreground">Prices listed in Nigerian Naira (₦)</span>
            </div>

            {filteredTutors.length === 0 ? (
              <Card className="p-12 text-center glass-card border-border/60">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-bold text-foreground">No Tutors Match Your Filters</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Try broadening your search query or removing subject/price filters to see more verified tutors.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTutors.map((tutor) => (
                  <Card
                    key={tutor.id}
                    className="p-5 glass-card border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Tutor Header Info */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-base text-primary shrink-0 glow-primary">
                          {tutor.profiles?.name?.charAt(0) || "T"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm text-foreground truncate">
                              {tutor.profiles?.name || "Verified Tutor"}
                            </h3>
                            <ShieldCheck className="w-4 h-4 text-primary shrink-0" title="Verified Educator" />
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {tutor.experience_years} years teaching experience
                          </p>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-md border border-accent/20 shrink-0">
                          <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                          <span className="text-xs font-bold text-accent">
                            {tutor.rating_average > 0 ? tutor.rating_average : "5.0"}
                          </span>
                        </div>
                      </div>

                      {/* Headline */}
                      <p className="text-xs font-medium text-foreground/90 line-clamp-2 leading-relaxed">
                        {tutor.headline}
                      </p>

                      {/* Subjects Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tutor.subjects.slice(0, 3).map((sub) => (
                          <Badge key={sub} variant="secondary" className="text-[10px] font-normal">
                            {sub}
                          </Badge>
                        ))}
                        {tutor.subjects.length > 3 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{tutor.subjects.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Pricing & CTA */}
                    <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                      <div>
                        {tutor.offers_free_sessions ? (
                          <Badge className="bg-accent/15 text-accent border-accent/20 text-[10px] font-bold">
                            FREE TRIAL AVAILABLE
                          </Badge>
                        ) : (
                          <div>
                            <span className="text-base font-extrabold text-foreground">
                              ₦{tutor.hourly_rate.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-muted-foreground">/hour</span>
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => navigate(`/tutor/${tutor.id}`)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-3 gap-1"
                      >
                        Book Lesson
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* BECOME A TUTOR APPLICATION MODAL */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-accent" />
              Apply as a STEM Genius Tutor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Teach Nigerian and global students online. Set your own schedule and hourly rates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Professional Headline *
              </label>
              <Input
                placeholder="e.g. UNILAG First-Class Graduate | 5+ Years JAMB & WAEC Physics Expert"
                value={appHeadline}
                onChange={(e) => setAppHeadline(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                About You & Teaching Approach *
              </label>
              <Textarea
                placeholder="Describe your background, subject mastery, and how you help students understand complex STEM topics..."
                value={appBio}
                onChange={(e) => setAppBio(e.target.value)}
                className="bg-secondary/40 text-xs min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Select Subjects You Teach (Up to 5) *
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-secondary/30 rounded-lg border border-border/40">
                {SUBJECTED.slice(0, 30).map((s) => {
                  const isPicked = appSubjects.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSubjectToggle(s.value)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        isPicked
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.value}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Years of Experience
                </label>
                <Input
                  type="number"
                  min="1"
                  value={appYears}
                  onChange={(e) => setAppYears(parseInt(e.target.value) || 1)}
                  className="bg-secondary/40 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Hourly Rate (₦ NGN)
                </label>
                <Input
                  type="number"
                  step="500"
                  value={appHourlyRate}
                  onChange={(e) => setAppHourlyRate(parseInt(e.target.value) || 0)}
                  className="bg-secondary/40 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Highest Degree / Qualification
                </label>
                <Input
                  placeholder="e.g. B.Sc Mathematics"
                  value={appDegree}
                  onChange={(e) => setAppDegree(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Institution / Alma Mater
                </label>
                <Input
                  placeholder="e.g. University of Lagos"
                  value={appInstitution}
                  onChange={(e) => setAppInstitution(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40">
              <input
                type="checkbox"
                id="freeTrialCheck"
                checked={appOffersFree}
                onChange={(e) => setAppOffersFree(e.target.checked)}
                className="w-4 h-4 text-primary"
              />
              <label htmlFor="freeTrialCheck" className="text-xs text-foreground cursor-pointer">
                Offer a free 20-minute introductory lesson to attract new students
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setApplyModalOpen(false)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplySubmit}
              disabled={isSubmittingApp}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5"
            >
              {isSubmittingApp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

