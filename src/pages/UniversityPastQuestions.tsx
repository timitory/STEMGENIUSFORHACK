import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, BookOpen, FileText, Sparkles, ArrowRight, Search,
  CheckCircle2, Shield, Users, Calendar, BookMarked,
  Loader2, Building2, Layers, ArrowLeft, Filter, XCircle, Eye, Upload,
  Clock, Shuffle, Settings2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getInstitutions,
  getAcademicProgrammes,
  getExamStructures,
  getUniversityCourses,
  getPastQuestionCollections,
} from "@/lib/pastQuestionsService";
import {
  Institution,
  AcademicProgramme,
  ExamStructure,
  UniversityCourse,
  PastQuestionCollection,
} from "@/types/pastQuestions";
import { PDFDocumentReader } from "@/components/pastQuestions/PDFDocumentReader";

const EXAM_SYSTEM_LABELS: Record<string, string> = {
  block: "Block Examination System",
  semester: "Semester System",
  trimester: "Trimester System",
  annual: "Annual Examination",
};

const STRUCTURE_TYPE_COLOR: Record<string, string> = {
  block: "text-violet-400 border-violet-400/40 bg-violet-500/10",
  semester: "text-blue-400 border-blue-400/40 bg-blue-500/10",
  trimester: "text-amber-400 border-amber-400/40 bg-amber-500/10",
  annual: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
  professional: "text-rose-400 border-rose-400/40 bg-rose-500/10",
};

export default function UniversityPastQuestions() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Hierarchical filter states
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [programmes, setProgrammes] = useState<AcademicProgramme[]>([]);
  const [examStructures, setExamStructures] = useState<ExamStructure[]>([]);
  const [courses, setCourses] = useState<UniversityCourse[]>([]);
  const [collections, setCollections] = useState<PastQuestionCollection[]>([]);

  // Selected values
  const [selectedInstitution, setSelectedInstitution] = useState("all");
  const [selectedProgramme, setSelectedProgramme] = useState("all");
  const [selectedStructure, setSelectedStructure] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // PDF Reader state
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState<PastQuestionCollection | null>(null);

  const activeProgramme = programmes.find((p) => p.id === selectedProgramme);
  const availableLevels = activeProgramme?.levels || [
    "100L", "200L", "300L", "400L", "500L", "600L",
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      initPage(session.user.id);
    });
  }, [navigate]);

  const initPage = async (userId: string) => {
    try {
      setLoading(true);
      const [profileRes, instData] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        getInstitutions(),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setInstitutions(instData);
    } finally {
      setLoading(false);
    }
  };

  // Institution change → load programmes
  useEffect(() => {
    if (selectedInstitution === "all") {
      setProgrammes([]);
      setSelectedProgramme("all");
      return;
    }
    getAcademicProgrammes(selectedInstitution).then((data) => {
      setProgrammes(data);
      setSelectedProgramme("all");
      setSelectedStructure("all");
      setCourses([]);
    });
  }, [selectedInstitution]);

  // Programme change → load exam structures
  useEffect(() => {
    if (selectedProgramme === "all") {
      setExamStructures([]);
      setSelectedStructure("all");
      setCourses([]);
      return;
    }
    getExamStructures(selectedProgramme, selectedInstitution === "all" ? undefined : selectedInstitution)
      .then((data) => {
        setExamStructures(data);
        setSelectedStructure("all");
      });
    getUniversityCourses(selectedProgramme, selectedLevel === "all" ? undefined : selectedLevel)
      .then(setCourses);
  }, [selectedProgramme, selectedInstitution]);

  // Level change → refresh courses
  useEffect(() => {
    if (selectedProgramme === "all") return;
    getUniversityCourses(selectedProgramme, selectedLevel === "all" ? undefined : selectedLevel)
      .then(setCourses);
  }, [selectedLevel]);

  // Load collections whenever any filter changes
  useEffect(() => {
    setCollectionsLoading(true);
    getPastQuestionCollections({
      institutionId: selectedInstitution,
      programmeId: selectedProgramme,
      examStructureId: selectedStructure,
      courseId: selectedCourse,
      academicLevel: selectedLevel,
      searchQuery: searchQuery.trim() || undefined,
    })
      .then(setCollections)
      .finally(() => setCollectionsLoading(false));
  }, [selectedInstitution, selectedProgramme, selectedStructure, selectedCourse, selectedLevel, searchQuery]);

  // CBT Pre-Quiz Configuration
  const [cbtModalOpen, setCbtModalOpen] = useState(false);
  const [selectedCbtCollection, setSelectedCbtCollection] = useState<PastQuestionCollection | null>(null);
  const [cbtMode, setCbtMode] = useState<"practice" | "timed_exam">("timed_exam");
  const [cbtCount, setCbtCount] = useState<number>(20);
  const [cbtDurationMinutes, setCbtDurationMinutes] = useState<number>(30);
  const [cbtShuffle, setCbtShuffle] = useState<boolean>(true);
  const [cbtSection, setCbtSection] = useState<string>("all");
  const [initialPdfDoc, setInitialPdfDoc] = useState<"question" | "answers" | "marking_scheme">("question");

  const handleOpenPDF = (collection: PastQuestionCollection, docType: "question" | "answers" | "marking_scheme" = "question") => {
    setActiveCollection(collection);
    setInitialPdfDoc(docType);
    setPdfReaderOpen(true);
  };

  const handleOpenCBTModal = (collection: PastQuestionCollection) => {
    setSelectedCbtCollection(collection);
    setCbtModalOpen(true);
  };

  const handleLaunchCBT = () => {
    if (!selectedCbtCollection) return;
    const params = new URLSearchParams({
      examTypeId: "1bae3155-f796-4764-bcfd-d6f43daa15ba", // UNIVERSITY
      mode: cbtMode,
      count: cbtCount.toString(),
      collectionId: selectedCbtCollection.id,
      shuffle: cbtShuffle ? "true" : "false",
    });
    if (cbtMode === "timed_exam") {
      params.set("duration", cbtDurationMinutes.toString());
    }
    if (selectedCbtCollection.academic_level) params.set("academicLevel", selectedCbtCollection.academic_level);
    if (selectedCbtCollection.subject) params.set("subject", selectedCbtCollection.subject);
    if (cbtSection && cbtSection !== "all") params.set("section", cbtSection);
    if (selectedCbtCollection.institution_id) params.set("institutionId", selectedCbtCollection.institution_id);
    setCbtModalOpen(false);
    navigate(`/past-questions/practice?${params.toString()}`);
  };

  const clearFilters = () => {
    setSelectedInstitution("all");
    setSelectedProgramme("all");
    setSelectedStructure("all");
    setSelectedCourse("all");
    setSelectedLevel("all");
    setSearchQuery("");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading University Past Questions Library…</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    selectedInstitution !== "all" ||
    selectedProgramme !== "all" ||
    selectedStructure !== "all" ||
    selectedCourse !== "all" ||
    selectedLevel !== "all" ||
    searchQuery.trim() !== "";

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/past-questions")}
            className="text-muted-foreground hover:text-foreground gap-1.5 shrink-0 px-2.5 h-8 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Exams
          </Button>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5 sm:mt-0">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                  University &amp; Medical Examination Library
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  Find past questions by institution, programme, block/semester, and course.
                  Practise interactively or read original compiled documents.
                </p>
              </div>
            </div>

            {/* Feature Badges */}
            <div className="flex flex-wrap gap-2 pl-0 sm:pl-13">
              {[
                { icon: Layers, label: "Block & Semester Systems", color: "text-violet-400" },
                { icon: FileText, label: "Compiler Collections", color: "text-amber-400" },
                { icon: BookOpen, label: "In-Platform PDF Reader", color: "text-blue-400" },
                { icon: Sparkles, label: "AI Model Answers", color: "text-primary" },
              ].map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-secondary/50 border border-border/40 px-2.5 py-1 rounded-lg text-xs"
                >
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CONTRIBUTE BANNER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-accent/10 border border-accent/30">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-accent">Have past questions to share?</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Help fellow students by contributing to our community library</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate("/past-questions/my-submissions")}
              className="flex-1 sm:flex-initial text-xs text-muted-foreground hover:text-foreground h-8"
            >
              My Submissions
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => navigate("/past-questions/submit")}
              className="flex-1 sm:flex-initial text-accent border-accent/40 hover:bg-accent/10 text-xs gap-1.5 h-8 font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              Submit Questions
            </Button>
          </div>
        </div>

        {/* FILTER PANEL */}
        <Card className="p-5 sm:p-6 glass-card border-border/60 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Find Past Questions</h3>
            </div>
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Institution */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                Institution / University
              </label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger className="bg-secondary/40 border-border/60 text-sm">
                  <SelectValue placeholder="Select Institution" />
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

            {/* Programme (conditional) */}
            {programmes.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Programme / Degree
                </label>
                <Select value={selectedProgramme} onValueChange={setSelectedProgramme}>
                  <SelectTrigger className="bg-secondary/40 border-border/60 text-sm">
                    <SelectValue placeholder="Select Programme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programmes</SelectItem>
                    {programmes.map((prog) => (
                      <SelectItem key={prog.id} value={prog.id}>
                        {prog.code ? `${prog.code} — ` : ""}{prog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Academic Level (conditional) */}
            {selectedProgramme !== "all" && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Academic Level
                </label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="bg-secondary/40 border-border/60 text-sm">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {availableLevels.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Exam Structure (Block / Semester) — conditional */}
            {examStructures.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  {activeProgramme?.examination_system === "block" ? "Block / Examination Period" : "Semester"}
                </label>
                <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                  <SelectTrigger className="bg-secondary/40 border-border/60 text-sm">
                    <SelectValue placeholder="All Structures" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Exam Periods</SelectItem>
                    {examStructures.map((es) => (
                      <SelectItem key={es.id} value={es.id}>
                        {es.name}
                        {es.academic_level ? ` (${es.academic_level})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Course (conditional) */}
            {courses.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Course / Subject
                </label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="bg-secondary/40 border-border/60 text-sm">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} — {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Search */}
            <div className={courses.length > 0 ? "" : "sm:col-span-2 lg:col-span-1"}>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                Search Collection or Compiler
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Shuiyebo, Anatomy, ANA 201…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/40 border-border/60 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Programme quick-info badge */}
          {activeProgramme && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs">
              <GraduationCap className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-wrap gap-2 items-center">
                <strong className="text-foreground">{activeProgramme.name}</strong>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                  {activeProgramme.code || activeProgramme.degree_type}
                </Badge>
                <Badge variant="outline" className={`text-[10px] border ${STRUCTURE_TYPE_COLOR[activeProgramme.examination_system] || ""}`}>
                  {EXAM_SYSTEM_LABELS[activeProgramme.examination_system] || activeProgramme.examination_system}
                </Badge>
                <span className="text-muted-foreground">{activeProgramme.faculty}</span>
              </div>
            </div>
          )}
        </Card>

        {/* COLLECTIONS GRID */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-primary" />
              {collectionsLoading ? "Loading…" : `${collections.length} Compilation${collections.length !== 1 ? "s" : ""} Found`}
            </h2>
            {hasActiveFilters && !collectionsLoading && (
              <span className="text-xs text-muted-foreground">
                Showing filtered results
              </span>
            )}
          </div>

          {collectionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-64 glass-card border-border/60 animate-pulse bg-secondary/20" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <Card className="p-12 text-center glass-card border-border/60">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-bold text-foreground">No Collections Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-2">
                {hasActiveFilters
                  ? "No past question compilations match your selected filters. Try adjusting or clearing the filters above."
                  : "No university past question collections have been published yet. Check back soon or contact the admin to upload a compilation."}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4 border-border/60 text-xs gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Clear All Filters
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {collections.map((col) => (
                <CollectionCard
                  key={col.id}
                  collection={col}
                  onOpenPDF={handleOpenPDF}
                  onStartPractice={handleOpenCBTModal}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CBT PRE-QUIZ CONFIGURATION DIALOG */}
      <Dialog open={cbtModalOpen} onOpenChange={setCbtModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configure CBT Examination Session
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedCbtCollection?.title || "Custom Past Question Practice"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Mode selection */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">Exam Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCbtMode("timed_exam")}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    cbtMode === "timed_exam"
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-secondary/40 border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                    <Clock className="w-4 h-4" /> Timed Exam
                  </div>
                  <p className="text-[10px] opacity-80">Simulates real exam pressure with a countdown clock.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCbtMode("practice")}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    cbtMode === "practice"
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-secondary/40 border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                    <BookOpen className="w-4 h-4" /> Practice Mode
                  </div>
                  <p className="text-[10px] opacity-80">Untimed revision with instant solution explanations.</p>
                </button>
              </div>
            </div>

            {/* Section / Module / Block selection */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5 flex items-center justify-between">
                <span>Examination Paper Section</span>
                <span className="text-[10px] text-primary">{selectedCbtCollection?.subject || "Subject"}</span>
              </label>
              <select
                value={cbtSection}
                onChange={(e) => setCbtSection(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-secondary/50 border-border/60 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Comprehensive (All Sections & Topics)</option>
                <option value="Block 1 / Section A">Block 1 / Section A (Fundamental Concepts)</option>
                <option value="Block 2 / Section B">Block 2 / Section B (Applied Clinical / Advanced Theory)</option>
                <option value="Multiple Choice Section">Section I — Objective Multiple Choice</option>
                <option value="Theory Conversion">Section II — Converted Theory & Explanations</option>
              </select>
            </div>

            {/* Question count */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">Question Count</label>
              <div className="flex items-center gap-2">
                {[10, 20, 30, 50].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCbtCount(num)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      cbtCount === num
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {num} Qs
                  </button>
                ))}
              </div>
            </div>

            {/* Duration (if timed) */}
            {cbtMode === "timed_exam" && (
              <div>
                <label className="font-semibold text-foreground block mb-1.5 flex items-center justify-between">
                  <span>Duration</span>
                  <span className="text-primary font-bold">{cbtDurationMinutes} Minutes</span>
                </label>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCbtDurationMinutes(mins)}
                      className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        cbtDurationMinutes === mins
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Randomize toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-semibold text-foreground text-xs">Shuffle Questions</p>
                  <p className="text-[10px] text-muted-foreground">Randomize order to prevent answer memorization</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={cbtShuffle}
                onChange={(e) => setCbtShuffle(e.target.checked)}
                className="w-4 h-4 rounded border-border/60"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCbtModalOpen(false)}
              className="text-xs border-border/60"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleLaunchCBT}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 glow-primary"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Begin CBT Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF DOCUMENT READER */}
      <PDFDocumentReader
        collection={activeCollection}
        initialDocType={initialPdfDoc}
        isOpen={pdfReaderOpen}
        onClose={() => {
          setPdfReaderOpen(false);
          setActiveCollection(null);
        }}
        onStartInteractivePractice={handleOpenCBTModal}
      />
    </div>
  );
}

// ─── Collection Card Component ───────────────────────────────────────────────

function CollectionCard({
  collection,
  onOpenPDF,
  onStartPractice,
}: {
  collection: PastQuestionCollection;
  onOpenPDF: (c: PastQuestionCollection, docType?: "question" | "answers" | "marking_scheme") => void;
  onStartPractice: (c: PastQuestionCollection) => void;
}) {
  const structureType =
    collection.exam_structures?.structure_type ||
    (collection.academic_programmes?.examination_system === "block" ? "block" : "semester");

  const colorClass = STRUCTURE_TYPE_COLOR[structureType] || STRUCTURE_TYPE_COLOR.semester;

  return (
    <Card className="p-5 glass-card border-border/60 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between space-y-4 group hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.2)]">
      {/* HEADER */}
      <div className="space-y-3">
        {/* Badges row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {collection.academic_level && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                {collection.academic_level}
              </Badge>
            )}
            {collection.exam_structures && (
              <Badge variant="outline" className={`text-[10px] border ${colorClass}`}>
                {collection.exam_structures.name}
              </Badge>
            )}
          </div>

          {collection.is_verified && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary/90 transition-colors">
            {collection.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
            <Shield className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Compiled by <strong className="text-foreground">{collection.compiler_name}</strong></span>
          </div>
        </div>

        {/* Description */}
        {collection.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
            {collection.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
          {collection.course_code && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-primary/60" />
              {collection.course_code}
            </span>
          )}
          {(collection.start_year || collection.end_year) && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-primary/60" />
              {collection.start_year}
              {collection.end_year && collection.end_year !== collection.start_year
                ? `–${collection.end_year}`
                : ""}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-primary/60" />
            {collection.view_count} views
          </span>
        </div>

        {/* Format tags */}
        <div className="flex flex-wrap gap-1.5">
          {collection.supported_formats.map((fmt) => (
            <span
              key={fmt}
              className="px-2 py-0.5 rounded-full bg-secondary/60 border border-border/40 text-[10px] text-muted-foreground uppercase font-mono"
            >
              {fmt}
            </span>
          ))}
          {collection.has_answers && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold">
              ✓ Answers
            </span>
          )}
          {collection.has_marking_scheme && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-400 font-semibold">
              ✓ Marking Scheme
            </span>
          )}
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {collection.document_url && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenPDF(collection, "question")}
            className="w-full border-border/60 text-xs gap-1.5 hover:border-primary/40 h-8"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            Read Paper
          </Button>
        )}
        {(collection.answers_document_url || collection.has_answers) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenPDF(collection, "answers")}
            className="w-full border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs gap-1.5 h-8"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Answers PDF
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => onStartPractice(collection)}
          className="w-full col-span-1 sm:col-span-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 glow-primary h-8"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Practise CBT Exam Mode
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

