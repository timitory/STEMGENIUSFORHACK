import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Video, Calendar, PlayCircle, Users, Clock, ShieldCheck, 
  Sparkles, CheckCircle2, Plus, ArrowRight, BookOpen, Radio, Loader2,
  Lock, KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { 
  fetchVirtualClasses, 
  registerForClass, 
  fetchCompletedRecordings, 
  createVirtualClass 
} from "@/lib/virtualClassService";
import { getExamTypes } from "@/lib/pastQuestionsService";
import { VirtualClass, ClassRecording } from "@/types/virtualClasses";
import { ExamType } from "@/types/pastQuestions";
import SUBJECTED from "./Subjects";

export default function VirtualClassesHub() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [classes, setClasses] = useState<VirtualClass[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [isTutorOrAdmin, setIsTutorOrAdmin] = useState(false);

  // Create Class Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSubject, setNewSubject] = useState("Mathematics");
  const [newTopic, setNewTopic] = useState("");
  const [newExamTypeId, setNewExamTypeId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("17:00");
  const [newDuration, setNewDuration] = useState(90);
  const [newCapacity, setNewCapacity] = useState(1000);
  const [newMeetingFormat, setNewMeetingFormat] = useState<"webinar" | "interactive_meeting">("webinar");
  const [newPasscode, setNewPasscode] = useState("");
  const [newAnnouncements, setNewAnnouncements] = useState("");
  const [newPreJoinQuestion, setNewPreJoinQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Immediate Pre-Join Registration Modal states
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regSuccessModalOpen, setRegSuccessModalOpen] = useState(false);
  const [targetClassForReg, setTargetClassForReg] = useState<VirtualClass | null>(null);
  const [regFormData, setRegFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    institution: "",
    department: "",
    customAnswer: "",
  });
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Host Registration configuration states
  const [newRegRequired, setNewRegRequired] = useState(true);
  const [newRegCollectPhone, setNewRegCollectPhone] = useState(false);
  const [newRegCollectInst, setNewRegCollectInst] = useState(true);
  const [newRegCollectDept, setNewRegCollectDept] = useState(true);

  // Passcode Join Dialog state
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [selectedClassForJoin, setSelectedClassForJoin] = useState<VirtualClass | null>(null);
  const [enteredPasscode, setEnteredPasscode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadInitialData(currentUser.id);
      } else {
        loadPublicData();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadInitialData(currentUser.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadPublicData = async () => {
    try {
      setLoading(true);
      const [classesData, recordingsData, examsData] = await Promise.all([
        fetchVirtualClasses(),
        fetchCompletedRecordings(),
        getExamTypes(),
      ]);
      setClasses(classesData);
      setRecordings(recordingsData);
      setExamTypes(examsData);
    } catch (err) {
      console.error("Error loading public classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async (userId: string) => {
    try {
      setLoading(true);
      const [profileRes, rolesRes, classesData, recordingsData, examsData] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        fetchVirtualClasses(userId),
        fetchCompletedRecordings(),
        getExamTypes(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setClasses(classesData);
      setRecordings(recordingsData);
      setExamTypes(examsData);

      const hasHostPrivilege = rolesRes.data?.some((r: any) =>
        ["admin", "moderator", "tutor"].includes(r.role)
      );
      setIsTutorOrAdmin(hasHostPrivilege || false);

      // Default tomorrow date for modal
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNewDate(tomorrow.toISOString().split("T")[0]);
    } catch (err) {
      console.error("Error loading classes:", err);
      toast.error("Failed to load virtual classes");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegistration = (cls: VirtualClass) => {
    if (!user) {
      toast.info("Please sign in or create an account to reserve your free seat.");
      sessionStorage.setItem("redirectAfterAuth", "/virtual-classes");
      navigate("/auth");
      return;
    }

    if (cls.is_registered) {
      toast.info("You are already registered for this session!");
      handleJoinClass(cls);
      return;
    }

    if (cls.max_capacity && (cls.registered_count || 0) >= cls.max_capacity) {
      toast.error("This webinar has reached full capacity (" + cls.max_capacity + " seats).");
      return;
    }

    setTargetClassForReg(cls);
    setRegFormData({
      fullName: profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "",
      email: user?.email || "",
      phone: profile?.phone || "",
      institution: profile?.institution_name || "",
      department: profile?.department || "",
      customAnswer: "",
    });
    setRegModalOpen(true);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassForReg || !user) return;
    setIsSubmittingReg(true);

    try {
      if (!regFormData.fullName.trim() || !regFormData.email.trim()) {
        toast.error("Please enter your name and email address");
        setIsSubmittingReg(false);
        return;
      }

      // Check if custom pre-join question was asked and is required
      if (targetClassForReg.pre_join_question && !regFormData.customAnswer.trim()) {
        toast.error("Please provide an answer to the educator's question");
        setIsSubmittingReg(false);
        return;
      }

      // Save registration directly to Supabase
      const { error } = await supabase.from("class_registrations").upsert(
        {
          class_id: targetClassForReg.id,
          user_id: user.id,
          registered_at: new Date().toISOString(),
          attendance_status: "registered",
          pre_join_answer: regFormData.customAnswer.trim() || null,
          registration_data: {
            fullName: regFormData.fullName.trim(),
            email: regFormData.email.trim(),
            phone: regFormData.phone.trim(),
            institution: regFormData.institution.trim(),
            department: regFormData.department.trim(),
            customAnswer: regFormData.customAnswer.trim(),
          },
        },
        { onConflict: "class_id,user_id" }
      );

      if (error) throw error;

      toast.success("Successfully registered for the live masterclass!");
      setRegModalOpen(false);
      setRegSuccessModalOpen(true);

      // Refresh classes list
      const updated = await fetchVirtualClasses(user.id);
      setClasses(updated);
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error("Registration failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleRegister = async (classId: string) => {
    if (!user) return;
    try {
      toast.loading("Registering for class...");
      const success = await registerForClass(classId, user.id);
      toast.dismiss();
      if (success) {
        toast.success("Successfully registered! You will receive live room updates.");
        const updated = await fetchVirtualClasses(user.id);
        setClasses(updated);
      }
    } catch {
      toast.dismiss();
      toast.error("Failed to register");
    }
  };

  const handleCreateClass = async () => {
    if (!user || !newTitle.trim() || !newSubject) {
      toast.error("Please fill in title and subject");
      return;
    }

    const startDateTime = new Date(`${newDate}T${newTime}:00`);
    if (startDateTime.getTime() < Date.now()) {
      toast.error("Please choose a future date and time");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createVirtualClass(user.id, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        subject: newSubject,
        topic: newTopic.trim() || undefined,
        examTypeId: newExamTypeId || undefined,
        scheduledStart: startDateTime.toISOString(),
        durationMinutes: newDuration,
        maxCapacity: newCapacity,
        accessType: "public",
        passcode: newPasscode.trim() || undefined,
        meetingFormat: newMeetingFormat,
        isRecordingEnabled: true,
        registrationSettings: {
          required: newRegRequired,
          collect_info: true,
          fields: {
            name: { enabled: true, required: true },
            email: { enabled: true, required: true },
            phone: { enabled: newRegCollectPhone, required: false },
            institution: { enabled: newRegCollectInst, required: false },
            department: { enabled: newRegCollectDept, required: false },
            custom_question: { enabled: !!newPreJoinQuestion.trim(), required: false, question: newPreJoinQuestion.trim() },
          }
        },
        hostAnnouncements: newAnnouncements.trim() || undefined,
        preJoinQuestion: newPreJoinQuestion.trim() || undefined,
      });

      toast.success("Virtual class scheduled! Room link is active.");
      setCreateModalOpen(false);
      setNewPasscode("");
      const updated = await fetchVirtualClasses(user.id);
      setClasses(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule class");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinClass = (cls: VirtualClass) => {
    // If the class has a passcode and the user is NOT the host, prompt for passcode
    const isHost = user && cls.host_id === user.id;
    if (cls.passcode && !isHost) {
      // Check if already entered in this session
      const savedPass = sessionStorage.getItem(`passcode_class_${cls.id}`);
      if (savedPass && savedPass === cls.passcode) {
        navigate(`/virtual-classes/room/${cls.room_id}`);
        return;
      }
      setSelectedClassForJoin(cls);
      setEnteredPasscode("");
      setPasscodeModalOpen(true);
    } else {
      navigate(`/virtual-classes/room/${cls.room_id}`);
    }
  };

  const handleVerifyPasscodeAndJoin = () => {
    if (!selectedClassForJoin) return;
    if (enteredPasscode.trim() === (selectedClassForJoin.passcode || "").trim()) {
      sessionStorage.setItem(`passcode_class_${selectedClassForJoin.id}`, enteredPasscode.trim());
      setPasscodeModalOpen(false);
      navigate(`/virtual-classes/room/${selectedClassForJoin.room_id}`, {
        state: { verifiedPasscode: enteredPasscode.trim() },
      });
    } else {
      toast.error("Incorrect meeting passcode. Please verify with the host.");
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Virtual Classes Hub...</p>
        </div>
      </div>
    );
  }

  const upcomingClasses = classes.filter((c) => c.status === "scheduled" || c.status === "live");
  const myRegisteredClasses = classes.filter((c) => c.is_registered);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile?.name || user?.email?.split("@")[0] || "Student"} isPremium={profile?.is_premium || false} onSignOut={() => supabase.auth.signOut()} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden glass-card p-4 sm:p-8 border border-border/60">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 border border-primary/20">
                  <Radio className="w-3.5 h-3.5 text-destructive animate-pulse" />
                  Large-Scale Virtual Classes &amp; Recordings
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                  Live Webinars &amp; <span className="gradient-text-primary">Recorded Masterclasses</span>
                </h1>
                <p className="text-xs sm:text-base text-muted-foreground mt-1.5 sm:mt-2 leading-relaxed">
                  Join real-time interactive lectures with up to 2,500+ students. Participate in live Q&A, raise your hand to speak, and revisit full HD recordings with slide notes.
                </p>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex flex-col items-stretch sm:items-center md:items-end gap-2 w-full md:w-auto">
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 glow-primary h-10 px-4 text-xs sm:text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Host / Start Meeting
                </Button>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground text-center md:text-right">
                  Low-latency broadcast architecture for smooth mobile streaming
                </span>
              </div>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="bg-secondary/60 p-1 border border-border/50 flex flex-wrap h-auto gap-1 w-full overflow-x-auto">
              <TabsTrigger value="upcoming" className="gap-1.5 flex-1 min-w-[120px] px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm">
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                <span className="whitespace-nowrap">Live &amp; Upcoming ({upcomingClasses.length})</span>
              </TabsTrigger>
              <TabsTrigger value="recordings" className="gap-1.5 flex-1 min-w-[120px] px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm">
                <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent shrink-0" />
                <span className="whitespace-nowrap">Recordings ({recordings.length})</span>
              </TabsTrigger>
              <TabsTrigger value="registered" className="gap-1.5 flex-1 min-w-[120px] px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="whitespace-nowrap">My Classes ({myRegisteredClasses.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: LIVE & UPCOMING CLASSES */}
            <TabsContent value="upcoming" className="space-y-4">
              {upcomingClasses.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <Video className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Classes Scheduled Right Now</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Check back soon or explore past class recordings in the Recorded Library tab.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {upcomingClasses.map((cls) => {
                    const isLive = cls.status === "live";
                    return (
                      <Card
                        key={cls.id}
                        className={`p-4 sm:p-6 glass-card border transition-all flex flex-col justify-between space-y-4 ${
                          isLive
                            ? "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/40"
                            : "border-border/60 hover:border-primary/40"
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isLive ? (
                                <Badge className="bg-destructive text-destructive-foreground animate-pulse text-[10px] font-bold">
                                  ● LIVE NOW
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                  {cls.subject}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">
                                {cls.max_capacity} Seats
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {cls.duration_minutes} Mins
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-foreground leading-snug">
                            {cls.title}
                          </h3>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {cls.description || "Join this live revision session with interactive Q&A."}
                          </p>

                          <div className="text-xs text-muted-foreground space-y-1 pt-1">
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-primary" />
                              <span>Host: {cls.host?.name || "Verified Educator"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-accent" />
                              <span>Scheduled: {new Date(cls.scheduled_start).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-primary font-semibold">Free Access</span>
                            {cls.passcode && (
                              <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-[10px] gap-1 py-0 h-5">
                                <Lock className="w-2.5 h-2.5" /> Passcode
                              </Badge>
                            )}
                          </div>

                          {isLive || cls.is_registered ? (
                            <Button
                              size="sm"
                              onClick={() => handleJoinClass(cls)}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5 glow-primary"
                            >
                              <Video className="w-4 h-4" />
                              {isLive ? "Enter Live Class" : "Enter Room"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRegistration(cls)}
                              className="border-border/60 text-xs h-9 gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              Register (Free)
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: RECORDED LESSONS LIBRARY */}
            <TabsContent value="recordings" className="space-y-4">
              {recordings.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <PlayCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Completed Recordings Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    When live classes finish, high-definition video recordings will be published here with slides and notes.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recordings.map((rec) => (
                    <Card
                      key={rec.id}
                      className="p-5 glass-card border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden bg-secondary/80 aspect-video flex items-center justify-center border border-border/40">
                          <PlayCircle className="w-12 h-12 text-primary/80 group-hover:scale-110 group-hover:text-primary transition-all" />
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                            {Math.floor(rec.duration_seconds / 60)} mins
                          </div>
                        </div>

                        <div>
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 mb-1.5">
                            {rec.virtual_classes?.subject || "STEM Masterclass"}
                          </Badge>
                          <h4 className="font-bold text-sm text-foreground line-clamp-2">
                            {rec.recording_title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Host: {rec.virtual_classes?.host?.name || "Educator"} • {rec.view_count} views
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border/40">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/virtual-classes/summary/${rec.virtual_classes?.room_id}`)}
                          className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground text-xs h-8 gap-1.5 transition-colors"
                        >
                          Watch Recording & Slides
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: MY REGISTRATIONS */}
            <TabsContent value="registered" className="space-y-4">
              {myRegisteredClasses.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">You Have Not Registered for Any Classes</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Explore upcoming classes above and reserve your seat to get instant access when lessons start.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {myRegisteredClasses.map((cls) => (
                    <Card key={cls.id} className="p-4 glass-card border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-foreground">{cls.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {cls.subject} • {new Date(cls.scheduled_start).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinClass(cls)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                      >
                        Enter Room
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* SCHEDULE VIRTUAL CLASS MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Schedule Live Virtual Class / Webinar
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Broadcast Zoom-powered high-definition video, slides, and interactive Q&A to students with automated cloud recording.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Class Title *
              </label>
              <Input
                placeholder="e.g. JAMB Mathematics 2024: Complete Calculus & Probability"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Subject & Topic *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {SUBJECTED.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Topic (e.g. Calculus)"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Scheduled Date *
                </label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Start Time *
                </label>
                <Select value={newTime} onValueChange={setNewTime}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="16:00">04:00 PM</SelectItem>
                    <SelectItem value="17:00">05:00 PM</SelectItem>
                    <SelectItem value="19:00">07:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Duration (Minutes)
                </label>
                <Select value={String(newDuration)} onValueChange={(v) => setNewDuration(parseInt(v))}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 Minutes</SelectItem>
                    <SelectItem value="90">90 Minutes (Standard)</SelectItem>
                    <SelectItem value="120">120 Minutes (Full Exam Revision)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Participant Capacity
                </label>
                <Select value={String(newCapacity)} onValueChange={(v) => setNewCapacity(parseInt(v))}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">500 Participants</SelectItem>
                    <SelectItem value="1000">1,000 Participants</SelectItem>
                    <SelectItem value="2500">2,500 Participants (Masterclass)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Meeting Format
                </label>
                <Select value={newMeetingFormat} onValueChange={(v: any) => setNewMeetingFormat(v)}>
                  <SelectTrigger className="bg-secondary/40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webinar">Webinar (Host Broadcast)</SelectItem>
                    <SelectItem value="interactive_meeting">Interactive Study Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Meeting Passcode (Optional)
                </label>
                <Input
                  placeholder="e.g. 1234 or STEM2026"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Attendee Pre-Join Intake Question (Optional)
              </label>
              <Input
                placeholder="e.g. What specific topic or exam question do you want solved today?"
                value={newPreJoinQuestion}
                onChange={(e) => setNewPreJoinQuestion(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                When specified, attendees must answer this question before entering the live session.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Announcements / Preparation Instructions for Students
              </label>
              <Textarea
                placeholder="What should students prepare before joining? (e.g. calculator, past question booklet)"
                value={newAnnouncements}
                onChange={(e) => setNewAnnouncements(e.target.value)}
                className="bg-secondary/40 text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClass}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Publish Scheduled Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── PRE-JOIN REGISTRATION INTAKE MODAL ───────────────────────── */}
      <Dialog open={regModalOpen} onOpenChange={setRegModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-semibold uppercase">
                {targetClassForReg?.subject || "Live Session"}
              </Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                Free Masterclass
              </Badge>
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Register for: {targetClassForReg?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {targetClassForReg?.host?.name ? `Hosted by ${targetClassForReg.host.name} • ` : ""}
              {targetClassForReg?.scheduled_start ? new Date(targetClassForReg.scheduled_start).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRegistration} className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Samuel Adekunle"
                  value={regFormData.fullName}
                  onChange={(e) => setRegFormData({ ...regFormData, fullName: e.target.value })}
                  className="bg-secondary/40 text-xs h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  type="email"
                  placeholder="e.g. samuel@example.com"
                  value={regFormData.email}
                  onChange={(e) => setRegFormData({ ...regFormData, email: e.target.value })}
                  className="bg-secondary/40 text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Phone Number (Optional)
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +234 801 234 5678"
                    value={regFormData.phone}
                    onChange={(e) => setRegFormData({ ...regFormData, phone: e.target.value })}
                    className="bg-secondary/40 text-xs h-9"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Institution / University
                  </label>
                  <Input
                    placeholder="e.g. LASU / UNILAG / High School"
                    value={regFormData.institution}
                    onChange={(e) => setRegFormData({ ...regFormData, institution: e.target.value })}
                    className="bg-secondary/40 text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Department / Programme
                </label>
                <Input
                  placeholder="e.g. Medicine & Surgery, Engineering, Computer Science"
                  value={regFormData.department}
                  onChange={(e) => setRegFormData({ ...regFormData, department: e.target.value })}
                  className="bg-secondary/40 text-xs h-9"
                />
              </div>

              {/* Educator's custom pre-join question */}
              {targetClassForReg?.pre_join_question && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Speaker Question: {targetClassForReg.pre_join_question}
                  </label>
                  <Textarea
                    required
                    placeholder="Type your answer for the host..."
                    value={regFormData.customAnswer}
                    onChange={(e) => setRegFormData({ ...regFormData, customAnswer: e.target.value })}
                    className="bg-secondary/40 text-xs min-h-[70px]"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingReg}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-md"
              >
                {isSubmittingReg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isSubmittingReg ? "Registering..." : "Confirm Free Registration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── REGISTRATION SUCCESS CONFIRMATION MODAL ────────────────── */}
      <Dialog open={regSuccessModalOpen} onOpenChange={setRegSuccessModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md text-center p-6 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-foreground">
              You are Registered!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Your seat has been reserved for <strong className="text-foreground">{targetClassForReg?.title}</strong>.
            </DialogDescription>
          </div>

          {targetClassForReg?.status === "live" ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                This webinar is broadcasting live right now!
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setRegSuccessModalOpen(false);
                  if (targetClassForReg) handleJoinClass(targetClassForReg);
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 gap-2 shadow-lg"
              >
                <Video className="w-4 h-4" />
                Enter Live Class Now
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/40 border border-border/40 text-xs text-muted-foreground space-y-1">
              <p>📅 Scheduled Start: <strong className="text-foreground">{targetClassForReg?.scheduled_start ? new Date(targetClassForReg.scheduled_start).toLocaleString() : "Soon"}</strong></p>
              <p>You can enter the room any time from the "My Registrations" tab.</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegSuccessModalOpen(false)}
              className="w-full text-xs"
            >
              Close
            </Button>
            {targetClassForReg?.status !== "live" && (
              <Button
                size="sm"
                onClick={() => {
                  setRegSuccessModalOpen(false);
                  if (targetClassForReg) handleJoinClass(targetClassForReg);
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
              >
                Go to Room
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PASSCODE ENTRY DIALOG */}
      <Dialog open={passcodeModalOpen} onOpenChange={setPasscodeModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Passcode Required
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              "{selectedClassForJoin?.title}" is protected with a meeting passcode. Enter it below to join.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Enter passcode"
                value={enteredPasscode}
                onChange={(e) => setEnteredPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerifyPasscodeAndJoin();
                }}
                className="bg-secondary/40 text-sm pl-9"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasscodeModalOpen(false)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleVerifyPasscodeAndJoin}
              disabled={!enteredPasscode.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              Enter Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

