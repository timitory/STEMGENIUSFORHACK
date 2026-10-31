import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GraduationCap, BookOpen, Clock, Target, Bookmark, History, 
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Filter, 
  RotateCcw, Award, ChevronRight, Layers, Flame, FileText, Search
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

  // User History & Bookmarks
  const [history, setHistory] = useState<PastQuestionSession[]>([]);
  const [bookmarks, setBookmarks] = useState<PastQuestionBookmark[]>([]);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
              {/* University Library Shortcut CTA */}
              <div className="mt-5">
                <button
                  onClick={() => navigate("/past-questions/university")}
                  className="group w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all duration-200 text-xs sm:text-sm font-semibold text-primary"
                >
                  <div className="flex items-center gap-2 truncate">
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="truncate">Open Medical &amp; University Library</span>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Workspace Tabs */}
          <Tabs defaultValue="practice" className="space-y-6">
            <TabsList className="bg-secondary/60 p-1 border border-border/50 flex flex-wrap h-auto gap-1 w-full">
              <TabsTrigger value="practice" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-1.5 text-xs sm:text-sm">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                <span className="whitespace-nowrap">Find Questions</span>
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-1.5 text-xs sm:text-sm">
                <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent shrink-0" />
                <span className="whitespace-nowrap">Saved ({bookmarks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 flex-1 min-w-[120px] px-2.5 py-1.5 text-xs sm:text-sm">
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
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

            {/* TAB 2: BOOKMARKS */}
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

