import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GraduationCap, BookOpen, Clock, Target, Bookmark, History, 
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Filter, 
  RotateCcw, Award, ChevronRight, Layers, Flame, FileText, Search,
  Library, BookCheck, Upload, Check, ExternalLink, Star
} from "lucide-react";
import { toast } from "sonner";
import {
  getExamTypes,
  getInstitutions,
  getDepartments,
  getPastQuestionsMeta,
  fetchPastQuestions,
  getUserSessionHistory,
  getUserBookmarks,
} from "@/lib/pastQuestionsService";
import { ExamType, Institution, ExamDepartment, PastQuestionSession, PastQuestionBookmark } from "@/types/pastQuestions";
import SUBJECTED from "./Subjects";

const CURATED_LIBRARY_STACKS = [
  {
    id: "jamb-10yr-stem",
    title: "JAMB UTME 10-Year STEM Complete Bank",
    examBody: "JAMB (UTME)",
    badge: "Official CBT Archive",
    description: "Complete 10-year question bank with verified step-by-step solutions for Mathematics, Physics, Chemistry, Biology, and Use of English.",
    subjects: ["Mathematics", "Physics", "Chemistry", "Biology"],
    yearSpan: "2015 - 2024",
    totalQuestions: "4,000+ Questions",
    mode: "timed_exam" as const,
    color: "border-blue-500/40 bg-blue-500/5",
  },
  {
    id: "waec-wassce-distinctions",
    title: "WAEC / WASSCE Distinctions Series",
    examBody: "WAEC (WASSCE)",
    badge: "Marking Scheme Verified",
    description: "Authentic objective and theory past examination papers with official WAEC step-by-step marking schemes and formula derivations.",
    subjects: ["General Mathematics", "Physics", "Chemistry", "Further Maths"],
    yearSpan: "2016 - 2024",
    totalQuestions: "2,500+ Questions",
    mode: "practice" as const,
    color: "border-emerald-500/40 bg-emerald-500/5",
  },
  {
    id: "neco-ssce-national",
    title: "NECO SSCE National Examination Archive",
    examBody: "NECO (SSCE)",
    badge: "Verified Solutions",
    description: "National Examinations Council Senior School Certificate papers formatted for self-paced revision and timed simulation.",
    subjects: ["Mathematics", "Biology", "Chemistry", "Economics"],
    yearSpan: "2017 - 2024",
    totalQuestions: "1,800+ Questions",
    mode: "practice" as const,
    color: "border-purple-500/40 bg-purple-500/5",
  },
  {
    id: "post-utme-top-unis",
    title: "Premier Universities Post-UTME Vault",
    examBody: "Post-UTME",
    badge: "High-Yield Screening",
    description: "Comprehensive screening questions for UNILAG, UI, OAU, UNIBEN, FUTO, and ABU to maximize admission aggregates.",
    subjects: ["General Paper", "STEM Bundle", "Aptitude"],
    yearSpan: "2018 - 2024",
    totalQuestions: "1,200+ Questions",
    mode: "timed_exam" as const,
    color: "border-amber-500/40 bg-amber-500/5",
  },
];

export default function PastQuestionsHub() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Metadata states
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<ExamDepartment[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // Filter selections
  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [selectedMode, setSelectedMode] = useState<"practice" | "timed_exam" | "topic_drill">("practice");
  const [questionCount, setQuestionCount] = useState<string>("10");

  // User History & Bookmarks & Contributions
  const [history, setHistory] = useState<PastQuestionSession[]>([]);
  const [bookmarks, setBookmarks] = useState<PastQuestionBookmark[]>([]);
  const [verifiedContributions, setVerifiedContributions] = useState<any[]>([]);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      loadUserData(session.user.id);
    });
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);
      const [profileRes, examTypesData, instData, historyData, bookmarksData] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        getExamTypes(),
        getInstitutions(),
        getUserSessionHistory(userId),
        getUserBookmarks(userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setExamTypes(examTypesData);
      setInstitutions(instData);
      setHistory(historyData);
      setBookmarks(bookmarksData);

      if (examTypesData.length > 0) {
        const defaultExam = examTypesData[0].id;
        setSelectedExamType(defaultExam);
      }

      // Populate default subjects from the rich Subjects taxonomy
      const subjectsList = SUBJECTED.map((s) => s.value).sort();
      setAvailableSubjects(subjectsList);

      // Load verified community contributions for the online library
      try {
        const { data: contribData } = await (supabase as any)
          .from("user_submitted_collections")
          .select("id, title, institution_name, course_title, course_code, academic_session, compiler_name, status, created_at, has_answers, has_marking_scheme")
          .order("created_at", { ascending: false })
          .limit(20);
        setVerifiedContributions(contribData || []);
      } catch (err) {
        console.warn("Could not load community contributions:", err);
      }
    } catch (error) {
      console.error("Error loading Past Questions Hub:", error);
      toast.error("Failed to load past questions data");
    } finally {
      setLoading(false);
    }
  };

  // Update topics when subject changes
  useEffect(() => {
    if (selectedSubject && selectedSubject !== "all") {
      const subjectObj = SUBJECTED.find((s) => s.value === selectedSubject);
      if (subjectObj && subjectObj.topics) {
        setAvailableTopics(subjectObj.topics);
      } else {
        setAvailableTopics([]);
      }
    } else {
      setAvailableTopics([]);
    }
    setSelectedTopic("all");
  }, [selectedSubject]);

  // Update departments when institution changes
  useEffect(() => {
    if (selectedInstitution && selectedInstitution !== "all") {
      getDepartments(selectedInstitution).then(setDepartments);
    } else {
      setDepartments([]);
    }
    setSelectedDepartment("all");
  }, [selectedInstitution]);

  // Query matching question count whenever filters change
  useEffect(() => {
    if (!selectedExamType) return;
    const checkCount = async () => {
      setIsSearching(true);
      try {
        const questions = await fetchPastQuestions({
          examTypeId: selectedExamType,
          institutionId: selectedInstitution !== "all" ? selectedInstitution : undefined,
          departmentId: selectedDepartment !== "all" ? selectedDepartment : undefined,
          academicLevel: selectedLevel !== "all" ? selectedLevel : undefined,
          subject: selectedSubject !== "all" ? selectedSubject : undefined,
          topic: selectedTopic !== "all" ? selectedTopic : undefined,
          year: selectedYear !== "all" ? parseInt(selectedYear) : undefined,
        });
        setMatchingCount(questions.length);
      } catch (err) {
        console.error("Failed to count questions:", err);
      } finally {
        setIsSearching(false);
      }
    };
    checkCount();
  }, [
    selectedExamType,
    selectedInstitution,
    selectedDepartment,
    selectedLevel,
    selectedSubject,
    selectedTopic,
    selectedYear,
  ]);

  const activeExamTypeObj = examTypes.find((e) => e.id === selectedExamType);

  const handleStartSession = () => {
    if (!selectedExamType) {
      toast.error("Please select an examination type");
      return;
    }

    const queryParams = new URLSearchParams({
      examTypeId: selectedExamType,
      mode: selectedMode,
      count: questionCount,
    });

    if (selectedSubject !== "all") queryParams.set("subject", selectedSubject);
    if (selectedTopic !== "all") queryParams.set("topic", selectedTopic);
    if (selectedYear !== "all") queryParams.set("year", selectedYear);
    if (selectedFormat !== "all") queryParams.set("format", selectedFormat);
    if (selectedInstitution !== "all") queryParams.set("institutionId", selectedInstitution);
    if (selectedDepartment !== "all") queryParams.set("departmentId", selectedDepartment);
    if (selectedLevel !== "all") queryParams.set("academicLevel", selectedLevel);

    navigate(`/past-questions/practice?${queryParams.toString()}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading Past Questions Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userName={profile.name} isPremium={profile.is_premium} onSignOut={handleSignOut} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden glass-card p-4 sm:p-8 border border-border/60">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold mb-3 border border-primary/20">
                <GraduationCap className="w-3.5 h-3.5" />
                National &amp; University Past Questions Hub
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                Exam Preparation &amp; <span className="gradient-text-primary">Past Questions</span>
              </h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1.5 sm:mt-2 leading-relaxed">
                Practise genuine past examination papers for JAMB/UTME, WAEC (WASSCE), NECO, Post-UTME, and Nigerian Universities. Build speed with timed CBT modes or master difficult concepts with step-by-step explanations.
              </p>

              {/* Quick Summary Badges */}
              <div className="flex flex-wrap gap-4 mt-6">
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40 text-xs">
                  <Target className="w-4 h-4 text-primary" />
                  <span>JAMB, WAEC & NECO</span>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40 text-xs">
                  <Award className="w-4 h-4 text-accent" />
                  <span>University 100L - 500L</span>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40 text-xs">
                  <Clock className="w-4 h-4 text-chart-3" />
                  <span>Timed CBT Simulation</span>
                </div>
              </div>
              {/* University & Library Action CTAs */}
              <div className="flex flex-wrap gap-3 mt-6">
                <Button
                  onClick={() => navigate("/past-questions/university")}
                  className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 text-xs sm:text-sm font-semibold gap-2"
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span>University &amp; Medical Library</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => navigate("/past-questions/submit")}
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 text-xs sm:text-sm font-semibold gap-2"
                >
                  <Upload className="w-4 h-4 shrink-0 text-accent" />
                  <span>Contribute Past Questions</span>
                  <Badge className="bg-accent/20 text-accent border-0 text-[10px]">Verified Badge</Badge>
                </Button>
                <Button
                  onClick={() => navigate("/past-questions/my-submissions")}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground text-xs sm:text-sm gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>My Submissions &amp; Status</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Library Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library catalog (e.g. WAEC Mathematics 2024, JAMB Physics, NECO Chemistry, MTH 101)..."
              className="pl-11 h-12 bg-secondary/30 border-border/60 text-sm rounded-xl focus:border-primary/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Main Workspace Tabs */}
          <Tabs defaultValue="practice" className="space-y-6">
            <TabsList className="bg-secondary/60 p-1 border border-border/50 flex flex-wrap h-auto gap-1 w-full">
              <TabsTrigger value="practice" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-2 text-xs sm:text-sm">
                <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="whitespace-nowrap">Exam Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="stacks" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-2 text-xs sm:text-sm">
                <Library className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="whitespace-nowrap">Curated Library Stacks</span>
              </TabsTrigger>
              <TabsTrigger value="contributions" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-2 text-xs sm:text-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Library Contributions ({verifiedContributions.length})</span>
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-2 text-xs sm:text-sm">
                <Bookmark className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="whitespace-nowrap">Saved ({bookmarks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-2 text-xs sm:text-sm">
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">History ({history.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FIND & PRACTISE */}
            <TabsContent value="practice" className="space-y-6">
              {/* Step 1: Examination Type Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                  1. Select Examination Body / Category
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                  {examTypes.map((type) => {
                    const isSelected = selectedExamType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedExamType(type.id)}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)]"
                            : "glass-card border-border/60 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-foreground">{type.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Target Criteria & Dynamic Filtering */}
              <Card className="p-5 sm:p-6 glass-card border-border/60 space-y-5">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">
                      2. Filter by Course, Topic & Academic Level
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {activeExamTypeObj?.name || "Exam Filters"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Conditional: Institution (only for Post-UTME & University) */}
                  {activeExamTypeObj?.has_institutions && (
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                        Institution / University
                      </label>
                      <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                        <SelectTrigger className="bg-secondary/40 border-border/60">
                          <SelectValue placeholder="All Institutions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Institutions</SelectItem>
                          {institutions.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.short_code} — {inst.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Conditional: Academic Level (100L - 500L for University) */}
                  {activeExamTypeObj?.has_levels && (
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                        Academic Level
                      </label>
                      <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                        <SelectTrigger className="bg-secondary/40 border-border/60">
                          <SelectValue placeholder="All Levels" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="100L">100 Level (Freshman)</SelectItem>
                          <SelectItem value="200L">200 Level</SelectItem>
                          <SelectItem value="300L">300 Level</SelectItem>
                          <SelectItem value="400L">400 Level</SelectItem>
                          <SelectItem value="500L">500 Level (Final Year)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subject Filter */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Subject / Course
                    </label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="all">All Subjects</SelectItem>
                        {availableSubjects.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Topic Filter */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Topic (Optional)
                    </label>
                    <Select
                      value={selectedTopic}
                      onValueChange={setSelectedTopic}
                      disabled={selectedSubject === "all" || availableTopics.length === 0}
                    >
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue
                          placeholder={
                            selectedSubject === "all"
                              ? "Select a subject first"
                              : availableTopics.length === 0
                              ? "No specific topics"
                              : "All Topics"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="all">All Topics</SelectItem>
                        {availableTopics.map((top) => (
                          <SelectItem key={top} value={top}>
                            {top}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Examination Year */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Examination Year
                    </label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years (2020 - 2024)</SelectItem>
                        <SelectItem value="2024">2024 Past Questions</SelectItem>
                        <SelectItem value="2023">2023 Past Questions</SelectItem>
                        <SelectItem value="2022">2022 Past Questions</SelectItem>
                        <SelectItem value="2021">2021 Past Questions</SelectItem>
                        <SelectItem value="2020">2020 Past Questions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Question Count */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Number of Questions
                    </label>
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="10 Questions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 Questions (Quick Drill)</SelectItem>
                        <SelectItem value="10">10 Questions (Standard)</SelectItem>
                        <SelectItem value="20">20 Questions (In-depth)</SelectItem>
                        <SelectItem value="40">40 Questions (Full JAMB Subject)</SelectItem>
                        <SelectItem value="50">50 Questions (WAEC Objective Paper)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Question Format */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Question Format
                    </label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="All Formats" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Formats (MCQ & Theory)</SelectItem>
                        <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                        <SelectItem value="theory">Structured / Theory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Step 3: Choose Practice Mode & Launch */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                  3. Select Preparation Mode & Launch Session
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Practice Mode */}
                  <div
                    onClick={() => setSelectedMode("practice")}
                    className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedMode === "practice"
                        ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-glow"
                        : "glass-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/20 text-primary">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Practice Mode</h4>
                        <span className="text-[11px] text-primary">Self-Paced Learning</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Answer questions without time pressure. Reveal step-by-step solutions, explore KaTeX math proofs, and bookmark difficult items for later review.
                    </p>
                  </div>

                  {/* Timed CBT Mode */}
                  <div
                    onClick={() => setSelectedMode("timed_exam")}
                    className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedMode === "timed_exam"
                        ? "bg-accent/10 border-accent ring-1 ring-accent/40 shadow-glow"
                        : "glass-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-accent/20 text-accent">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Timed CBT Mode</h4>
                        <span className="text-[11px] text-accent">Real Exam Simulation</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Authentic CBT timer, question palette navigator, and auto-submit. Tests real exam speed, endurance, and produces detailed accuracy scorecards.
                    </p>
                  </div>

                  {/* Topic Drill Mode */}
                  <div
                    onClick={() => setSelectedMode("topic_drill")}
                    className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedMode === "topic_drill"
                        ? "bg-chart-3/10 border-chart-3 ring-1 ring-chart-3/40"
                        : "glass-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-chart-3/20 text-chart-3">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Topic Mastery Drill</h4>
                        <span className="text-[11px] text-chart-3">Target Weak Areas</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Laser-focused practice questions on specific syllabus topics. Perfect for pre-test revision and diagnosing gaps in understanding.
                    </p>
                  </div>
                </div>

                {/* Launch Bar */}
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-card border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Ready to start your {selectedMode === "timed_exam" ? "CBT Exam" : "Practice"}?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isSearching ? (
                          "Checking question bank..."
                        ) : matchingCount !== null ? (
                          `${matchingCount} questions match your current criteria`
                        ) : (
                          "Questions loaded from official syllabus"
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartSession}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-lg glow-primary px-6"
                  >
                    Start {selectedMode === "timed_exam" ? "CBT Examination" : "Practice Session"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CURATED LIBRARY STACKS */}
            <TabsContent value="stacks" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Library className="w-5 h-5 text-accent" />
                    Curated Examination Stacks &amp; Archives
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pre-compiled, syllabus-aligned past question collections with verified solutions and marking schemes.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs text-accent border-accent/40 w-fit">
                  Verified Academic Stacks
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {CURATED_LIBRARY_STACKS.map((stack) => (
                  <Card
                    key={stack.id}
                    className={`p-6 border glass-card space-y-4 hover:border-primary/50 transition-all ${stack.color}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {stack.examBody}
                          </Badge>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {stack.badge}
                          </Badge>
                        </div>
                        <h4 className="text-base font-bold text-foreground leading-snug">
                          {stack.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {stack.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stack.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="px-2 py-0.5 rounded-md bg-secondary/60 text-foreground text-[11px] border border-border/40"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Years: <strong className="text-foreground">{stack.yearSpan}</strong></span>
                      <span>{stack.totalQuestions}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        onClick={() => {
                          const examObj = examTypes.find((e) => e.name.toLowerCase().includes(stack.examBody.toLowerCase().slice(0, 4)));
                          const examId = examObj ? examObj.id : (examTypes[0]?.id || "");
                          navigate(`/past-questions/practice?examTypeId=${examId}&mode=${stack.mode}&count=20`);
                        }}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 h-9"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Open in Enlarged Reading &amp; Practice Desk
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: COMMUNITY CONTRIBUTIONS & VERIFICATION DESK */}
            <TabsContent value="contributions" className="space-y-6">
              {/* Verification Standard Banner */}
              <Card className="p-6 glass-card border-border/60 bg-gradient-to-r from-emerald-950/20 via-background to-secondary/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-foreground">
                        STEM Genius Library Contribution &amp; Peer Verification
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                      Just as in university libraries, students, educators, and scholars can deposit past question papers, answer keys, and marking schemes. Every paper is reviewed for accuracy before publication.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      onClick={() => navigate("/past-questions/submit")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 h-9 shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Contribute Past Question
                    </Button>
                    <Button
                      onClick={() => navigate("/past-questions/my-submissions")}
                      variant="outline"
                      className="border-border/60 text-xs font-semibold h-9"
                    >
                      Track My Submissions
                    </Button>
                  </div>
                </div>

                {/* 3-Step Verification Pipeline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-border/40">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-semibold text-foreground">Authentic Paper Intake</p>
                      <p className="text-[11px] text-muted-foreground">Original PDF paper uploaded with exam body or university attribution.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-semibold text-foreground">Academic Verification</p>
                      <p className="text-[11px] text-muted-foreground">Marking schemes and solutions vetted by academic moderators.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-semibold text-foreground">Published With Seal</p>
                      <p className="text-[11px] text-muted-foreground">Paper enters the permanent digital stacks with Verified Library Badge.</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Verified Community Papers Feed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BookCheck className="w-4 h-4 text-primary" />
                    Community Deposited &amp; Verified Papers
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {verifiedContributions.length} collections deposited
                  </span>
                </div>

                {verifiedContributions.length === 0 ? (
                  <Card className="p-10 text-center glass-card border-border/60 space-y-3">
                    <Library className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                    <h5 className="font-bold text-sm text-foreground">No Submissions Yet</h5>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Be the first to deposit authentic past questions for WAEC, JAMB, NECO, or your University into the national library.
                    </p>
                    <Button
                      onClick={() => navigate("/past-questions/submit")}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs mt-2"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Submit First Paper
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {verifiedContributions.map((item) => (
                      <Card
                        key={item.id}
                        className="p-5 glass-card border-border/60 space-y-3 hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-primary block">
                              {item.institution_name}
                            </span>
                            <h5 className="font-bold text-sm text-foreground mt-0.5">
                              {item.title}
                            </h5>
                          </div>
                          <Badge
                            className={`text-[10px] shrink-0 ${
                              item.status === "approved" || item.status === "published"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {item.status === "approved" || item.status === "published"
                              ? "Verified by Library"
                              : "Under Review"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Subject: <strong className="text-foreground">{item.course_title}</strong></span>
                          <span>•</span>
                          <span>Year: <strong className="text-foreground">{item.academic_session}</strong></span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Compiler: <strong className="text-foreground">{item.compiler_name || "Community Scholar"}</strong></span>
                          {item.has_answers && (
                            <Badge variant="outline" className="text-[9px] text-primary border-primary/30">
                              Solutions Included
                            </Badge>
                          )}
                          {item.has_marking_scheme && (
                            <Badge variant="outline" className="text-[9px] text-accent border-accent/30">
                              Marking Scheme
                            </Badge>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => navigate("/past-questions/university")}
                            className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 gap-1"
                          >
                            Open in University Library
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="bookmarks" className="space-y-4">
              {bookmarks.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <Bookmark className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Bookmarked Questions Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    When you encounter challenging questions during practice, tap the bookmark icon to save them here for quick revision.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bookmarks.map((b) => (
                    <Card key={b.id} className="p-4 glass-card border-border/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs text-primary border-primary/30">
                          {b.past_questions?.subject || "Subject"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {b.past_questions?.year} • {b.past_questions?.topic || "General"}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-3">
                        {b.past_questions?.question_text}
                      </p>
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {b.past_questions?.exam_types?.name}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary gap-1"
                          onClick={() => {
                            if (b.past_questions?.exam_type_id) {
                              navigate(
                                `/past-questions/practice?examTypeId=${b.past_questions.exam_type_id}&subject=${b.past_questions.subject}`
                              );
                            }
                          }}
                        >
                          Revise Subject <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: EXAM HISTORY */}
            <TabsContent value="history" className="space-y-4">
              {history.length === 0 ? (
                <Card className="p-12 text-center glass-card border-border/60">
                  <History className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-foreground">No Examination History</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Your completed practice sessions and timed CBT examinations will appear here with scores, accuracy, and topic breakdowns.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {history.map((s) => (
                    <Card
                      key={s.id}
                      className="p-4 glass-card border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{s.subject}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {s.session_mode === "timed_exam" ? "Timed CBT" : "Practice"}
                          </Badge>
                          {s.year && <span className="text-xs text-muted-foreground">({s.year})</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.exam_types?.name} • Completed on {new Date(s.completed_at || s.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-lg font-extrabold text-primary">
                            {s.accuracy_percentage}%
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {s.correct_answers}/{s.total_questions} Correct
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/past-questions/results/${s.id}`)}
                          className="h-8 text-xs border-border/60 gap-1"
                        >
                          View Breakdown
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

