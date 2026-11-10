import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Upload, FileText, CheckCircle2, Info, Loader2, AlertCircle, Sparkles, BookOpen, Check
} from "lucide-react";
import { toast } from "sonner";

const ACADEMIC_LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L", "Postgraduate", "Other"];
const EXAM_PERIODS = [
  "First Semester", "Second Semester",
  "First Block", "Second Block", "Third Block",
  "Annual", "Trimester 1", "Trimester 2", "Trimester 3",
  "Continuous Assessment", "Other"
];
const QUESTION_FORMAT_OPTIONS = ["MCQ", "Theory", "Short Answer (SAQ)", "Practical"];

export default function SubmitPastQuestions() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Category: National Standard Exams (WAEC, JAMB, NECO) vs University / Higher Education
  const [submissionCategory, setSubmissionCategory] = useState<"national" | "university">("national");
  const [nationalExamBody, setNationalExamBody] = useState("WAEC (WASSCE)");
  const [nationalSubject, setNationalSubject] = useState("Mathematics");
  const [nationalPaperType, setNationalPaperType] = useState("Paper 1 (Objective / CBT)");
  const [nationalYear, setNationalYear] = useState("2024");

  // Form state
  const [institutionName, setInstitutionName] = useState("");
  const [faculty, setFaculty] = useState("");
  const [programme, setProgramme] = useState("");
  const [academicLevel, setAcademicLevel] = useState("");
  const [examPeriod, setExamPeriod] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [questionFormats, setQuestionFormats] = useState<string[]>([]);
  const [collectionTitle, setCollectionTitle] = useState("");
  const [compilerName, setCompilerName] = useState("");
  const [description, setDescription] = useState("");
  const [hasAnswers, setHasAnswers] = useState(false);
  const [hasMarkingScheme, setHasMarkingScheme] = useState(false);

  // Files
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null);

  // AI Generation States
  const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false);
  const [aiAnswers, setAiAnswers] = useState("");
  const [answersModalOpen, setAnswersModalOpen] = useState(false);

  const [isGeneratingScheme, setIsGeneratingScheme] = useState(false);
  const [aiScheme, setAiScheme] = useState("");
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle()
        .then(({ data }) => setProfile(data));
      setLoading(false);
    });
  }, [navigate]);

  const toggleFormat = (fmt: string) => {
    setQuestionFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error(`${label}: Please upload a valid PDF file.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(`${label}: File must be under 25 MB.`);
      return;
    }
    setter(file);
    toast.success(`${label} selected: ${file.name}`);
  };

  // AI-Assisted Answers Generation
  const handleGenerateAIAnswers = async () => {
    if (!courseTitle.trim() && !collectionTitle.trim()) {
      toast.error("Please enter Course Title and Collection Title first so AI knows what to solve.");
      return;
    }

    setIsGeneratingAnswers(true);
    try {
      const prompt = `You are a university professor and examiner in ${courseTitle || "STEM disciplines"}.
Please generate a comprehensive, high-yield model answer guide and step-by-step explanations for the past examination in:
Course: ${courseCode} - ${courseTitle}
Institution / Programme: ${institutionName || "University"} / ${programme || "General"}
Level / Period: ${academicLevel || "Undergraduate"} (${examPeriod || "Standard Examination"})
Format: ${questionFormats.join(", ") || "MCQ and Theory"}
Scope Description: ${description || "Comprehensive syllabus past exam"}

Provide:
1. Clear, numbered model solutions with high-yield rationale.
2. Clinical/practical correlations where relevant.
3. Common student pitfalls and exam memory tips.`;

      const { data, error } = await supabase.functions.invoke("ai-helper", {
        body: { prompt, type: "homework" },
      });

      if (error) throw error;
      const text = data?.reply || data?.text || data?.solution || (typeof data === "string" ? data : "");
      if (!text) throw new Error("No response generated by AI assistant.");

      setAiAnswers(text);
      setHasAnswers(true);
      setAnswersModalOpen(true);
      toast.success("AI Model Answers generated successfully!");
    } catch (err: any) {
      console.error("AI Answers error:", err);
      toast.error(err.message || "Failed to generate AI answers.");
    } finally {
      setIsGeneratingAnswers(false);
    }
  };

  // AI-Assisted Marking Scheme Generation
  const handleGenerateAIMarkingScheme = async () => {
    if (!courseTitle.trim() && !collectionTitle.trim()) {
      toast.error("Please enter Course Title and Collection Title first.");
      return;
    }

    setIsGeneratingScheme(true);
    try {
      const prompt = `You are a senior university examination board examiner in ${courseTitle || "STEM"}.
Create an authoritative, fair, and rigorous marking scheme and grading rubric for:
Course: ${courseCode} - ${courseTitle}
Institution: ${institutionName || "University"}
Level / Period: ${academicLevel || "Undergraduate"} (${examPeriod || "Standard Examination"})
Formats: ${questionFormats.join(", ") || "MCQ, Theory, SAQ"}

Include:
1. Section-by-section mark allocation (e.g. Total 100 marks).
2. Key points required for full marks vs partial marks.
3. Negative marking guidelines (if applicable for MCQs).
4. Grading criteria rubric (A, B, C, D, F thresholds).`;

      const { data, error } = await supabase.functions.invoke("ai-helper", {
        body: { prompt, type: "homework" },
      });

      if (error) throw error;
      const text = data?.reply || data?.text || data?.solution || (typeof data === "string" ? data : "");
      if (!text) throw new Error("No response generated by AI assistant.");

      setAiScheme(text);
      setHasMarkingScheme(true);
      setSchemeModalOpen(true);
      toast.success("AI Marking Scheme generated successfully!");
    } catch (err: any) {
      console.error("AI Marking Scheme error:", err);
      toast.error(err.message || "Failed to generate marking scheme.");
    } finally {
      setIsGeneratingScheme(false);
    }
  };

  const uploadFileToStorage = async (file: File, prefix: string): Promise<string> => {
    const fileName = `${prefix}_${crypto.randomUUID()}.pdf`;
    const storagePath = `submissions/${user.id}/${fileName}`;
    const { error } = await supabase.storage
      .from("past-question-pdfs")
      .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return storagePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const effectiveInst = submissionCategory === "national" ? nationalExamBody : institutionName.trim();
    const effectiveSession = submissionCategory === "national" ? nationalYear : academicSession.trim();
    const effectiveCourseTitle = submissionCategory === "national" ? nationalSubject : courseTitle.trim();
    const effectiveCourseCode = submissionCategory === "national" ? nationalPaperType : (courseCode.trim() || null);
    const effectiveCollectionTitle = collectionTitle.trim() || `${effectiveInst} ${effectiveCourseTitle} (${effectiveSession})`;

    // Validation
    if (!effectiveInst) { toast.error("Exam body or institution name is required"); return; }
    if (!effectiveSession) { toast.error("Examination year or session is required"); return; }
    if (!effectiveCourseTitle) { toast.error("Subject or course title is required"); return; }
    if (!compilerName.trim()) { toast.error("Compiler / attribution name is required"); return; }
    if (!questionFile) { toast.error("Please attach the Question Document (PDF)"); return; }

    setSubmitting(true);
    const uploadedPaths: string[] = [];

    try {
      // 1. Upload Question Paper (Required)
      setUploadProgress("Uploading Question Paper...");
      const questionDocPath = await uploadFileToStorage(questionFile, "question");
      uploadedPaths.push(questionDocPath);

      // 2. Upload Answers Paper (Optional)
      let answersDocPath: string | null = null;
      if (answersFile) {
        setUploadProgress("Uploading Answer Sheet...");
        answersDocPath = await uploadFileToStorage(answersFile, "answers");
        uploadedPaths.push(answersDocPath);
      }

      // 3. Upload Marking Scheme (Optional)
      let markingSchemeDocPath: string | null = null;
      if (markingSchemeFile) {
        setUploadProgress("Uploading Marking Scheme...");
        markingSchemeDocPath = await uploadFileToStorage(markingSchemeFile, "marking_scheme");
        uploadedPaths.push(markingSchemeDocPath);
      }

      // 4. Insert submission record
      setUploadProgress("Finalising submission...");
      const { error: insertError } = await (supabase as any).from("user_submitted_collections").insert({
        submitted_by: user.id,
        institution_name: effectiveInst,
        faculty: submissionCategory === "national" ? "National Examination" : (faculty.trim() || null),
        programme: submissionCategory === "national" ? nationalExamBody : (programme.trim() || null),
        academic_level: submissionCategory === "national" ? "Secondary / Pre-Degree" : (academicLevel || null),
        exam_period: submissionCategory === "national" ? nationalPaperType : (examPeriod || null),
        academic_session: effectiveSession,
        course_code: effectiveCourseCode,
        course_title: effectiveCourseTitle,
        question_formats: questionFormats.length > 0 ? questionFormats : [submissionCategory === "national" ? "MCQ & Theory" : "MCQ"],
        title: effectiveCollectionTitle,
        compiler_name: compilerName.trim(),
        description: description.trim() || (submissionCategory === "national" ? `Official ${effectiveInst} past questions for ${effectiveCourseTitle}.` : null),
        has_answers: hasAnswers || !!answersDocPath || !!aiAnswers,
        has_marking_scheme: hasMarkingScheme || !!markingSchemeDocPath || !!aiScheme,
        document_url: questionDocPath,
        answers_document_url: answersDocPath,
        marking_scheme_document_url: markingSchemeDocPath,
        ai_generated_answers: aiAnswers.trim() || null,
        ai_generated_marking_scheme: aiScheme.trim() || null,
        status: "pending",
      });

      if (insertError) {
        // Rollback uploaded files
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("past-question-pdfs").remove(uploadedPaths);
        }
        throw new Error(insertError.message);
      }

      setSubmitted(true);
      toast.success("Submission received! Our moderation team will review it for publication.");
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  };

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

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Back */}
        <Button
          variant="ghost" size="sm"
          onClick={() => navigate("/past-questions/university")}
          className="gap-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to University Past Questions
        </Button>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Submit Past Questions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contribute past examination papers, solutions, and marking schemes across universities and medical colleges.
          </p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Verified Submission System: </span>
            Upload authentic past question papers. You can also provide or AI-generate verified answers and marking schemes.
            Every submission is screened by administrators before immediate automatic publication into the global library.
          </p>
        </div>

        {submitted ? (
          /* Success State */
          <Card className="p-8 glass-card border-border/80 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Submission Received!</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Thank you for contributing to the STEM Genius University Library. Your submission has entered the moderation queue
              and will be published immediately upon administrative approval.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => navigate("/past-questions/my-submissions")}
                className="border-border/60 text-xs"
              >
                View My Submissions
              </Button>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setInstitutionName(""); setFaculty(""); setProgramme("");
                  setAcademicLevel(""); setExamPeriod(""); setAcademicSession("");
                  setCourseCode(""); setCourseTitle(""); setQuestionFormats([]);
                  setCollectionTitle(""); setCompilerName(""); setDescription("");
                  setHasAnswers(false); setHasMarkingScheme(false);
                  setQuestionFile(null); setAnswersFile(null); setMarkingSchemeFile(null);
                  setAiAnswers(""); setAiScheme("");
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              >
                Submit Another
              </Button>
            </div>
          </Card>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selector: National Exams vs University */}
            <Card className="p-6 glass-card border-border/60 space-y-3">
              <h3 className="font-bold text-sm text-foreground">
                1. Select Examination Tier
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubmissionCategory("national")}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    submissionCategory === "national"
                      ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-glow"
                      : "bg-secondary/30 border-border/50 hover:border-border"
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">National Examinations</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      WAEC (WASSCE), JAMB (UTME), NECO (SSCE), GCE & Post-UTME past question papers.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubmissionCategory("university")}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    submissionCategory === "university"
                      ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-glow"
                      : "bg-secondary/30 border-border/50 hover:border-border"
                  }`}
                >
                  <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">University & Higher Education</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Degree, Medical, Engineering, and Polytechnic semester & block examinations.
                    </p>
                  </div>
                </button>
              </div>
            </Card>

            {/* Section: Exam / Institution Details */}
            <Card className="p-6 glass-card border-border/60 space-y-4">
              <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-2">
                2. {submissionCategory === "national" ? "Examination & Subject Details" : "Institution & Programme Details"}
              </h3>

              {submissionCategory === "national" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Examination Body <span className="text-red-500">*</span>
                    </label>
                    <Select value={nationalExamBody} onValueChange={setNationalExamBody}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select Exam Body" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WAEC (WASSCE)">WAEC / WASSCE (West African Senior School Cert)</SelectItem>
                        <SelectItem value="JAMB (UTME)">JAMB / UTME (Unified Tertiary Matriculation)</SelectItem>
                        <SelectItem value="NECO (SSCE)">NECO (National Examinations Council)</SelectItem>
                        <SelectItem value="Post-UTME Screening">Post-UTME Screening (Top Universities)</SelectItem>
                        <SelectItem value="GCE / Private">GCE / Private Candidate Examination</SelectItem>
                        <SelectItem value="NABTEB">NABTEB (National Business & Technical)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <Select value={nationalSubject} onValueChange={setNationalSubject}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="Mathematics">Mathematics / General Maths</SelectItem>
                        <SelectItem value="English Language">English Language & Comprehension</SelectItem>
                        <SelectItem value="Physics">Physics</SelectItem>
                        <SelectItem value="Chemistry">Chemistry</SelectItem>
                        <SelectItem value="Biology">Biology</SelectItem>
                        <SelectItem value="Further Mathematics">Further Mathematics</SelectItem>
                        <SelectItem value="Agricultural Science">Agricultural Science</SelectItem>
                        <SelectItem value="Economics">Economics</SelectItem>
                        <SelectItem value="Government">Government</SelectItem>
                        <SelectItem value="Civic Education">Civic Education</SelectItem>
                        <SelectItem value="Computer Studies">Computer Studies / Data Processing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Examination Year <span className="text-red-500">*</span>
                    </label>
                    <Select value={nationalYear} onValueChange={setNationalYear}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014"].map(yr => (
                          <SelectItem key={yr} value={yr}>{yr} Past Questions</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Paper Format / Component
                    </label>
                    <Select value={nationalPaperType} onValueChange={setNationalPaperType}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select Paper" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paper 1 (Objective / CBT)">Paper 1 (Objectives / CBT Multiple Choice)</SelectItem>
                        <SelectItem value="Paper 2 (Theory / Essay)">Paper 2 (Essay & Written Working)</SelectItem>
                        <SelectItem value="Paper 3 (Practical)">Paper 3 (Practical / Alternative to Practical)</SelectItem>
                        <SelectItem value="Complete Pack (Papers 1 & 2)">Complete Combined Pack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Institution / University Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. University of Lagos, LASUCOM, OAU, Ahmadu Bello University"
                      value={institutionName}
                      onChange={e => setInstitutionName(e.target.value)}
                      className="bg-secondary/40 text-xs"
                      required={submissionCategory === "university"}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Faculty / College / School
                    </label>
                    <Input
                      placeholder="e.g. College of Medicine, Faculty of Science"
                      value={faculty}
                      onChange={e => setFaculty(e.target.value)}
                      className="bg-secondary/40 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Department / Programme
                    </label>
                    <Input
                      placeholder="e.g. Medicine & Surgery (MBBS), BDS, Computer Science"
                      value={programme}
                      onChange={e => setProgramme(e.target.value)}
                      className="bg-secondary/40 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Academic Level
                    </label>
                    <Select value={academicLevel} onValueChange={setAcademicLevel}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACADEMIC_LEVELS.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Examination Period / Block / Semester
                    </label>
                    <Select value={examPeriod} onValueChange={setExamPeriod}>
                      <SelectTrigger className="bg-secondary/40 text-xs">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_PERIODS.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Academic Session / Year <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. 2023/2024 or 2024"
                      value={academicSession}
                      onChange={e => setAcademicSession(e.target.value)}
                      className="bg-secondary/40 text-xs"
                      required={submissionCategory === "university"}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Course Code
                    </label>
                    <Input
                      placeholder="e.g. ANA 201, PHY 301, BCH 202"
                      value={courseCode}
                      onChange={e => setCourseCode(e.target.value)}
                      className="bg-secondary/40 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                      Course Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Gross Anatomy & Histology, Systemic Pathology, Biochemistry"
                      value={courseTitle}
                      onChange={e => setCourseTitle(e.target.value)}
                      className="bg-secondary/40 text-xs"
                      required={submissionCategory === "university"}
                    />
                  </div>
                </div>
              )}
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                    Question Formats Included
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUESTION_FORMAT_OPTIONS.map(fmt => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => toggleFormat(fmt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          questionFormats.includes(fmt)
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
            </Card>

            {/* Section: Collection Info */}
            <Card className="p-6 glass-card border-border/60 space-y-4">
              <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-2">
                Collection & Attribution
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                    Collection Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. MBBS 200L First Professional Physiology Exam Compilation"
                    value={collectionTitle}
                    onChange={e => setCollectionTitle(e.target.value)}
                    className="bg-secondary/40 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                    Compiler / Source Attribution <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Compiled by MedStudents Academic Committee, or Official Departmental Past Questions"
                    value={compilerName}
                    onChange={e => setCompilerName(e.target.value)}
                    className="bg-secondary/40 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                    Description & Syllabus Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Add overview, topics examined, lecturer tips, or special instructions..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-secondary/40 text-xs min-h-[75px]"
                  />
                </div>
              </div>
            </Card>

            {/* Section: Document Uploads & AI Assistance */}
            <Card className="p-6 glass-card border-border/60 space-y-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h3 className="font-bold text-sm text-foreground">
                  Documents & Solutions
                </h3>
                <span className="text-[11px] text-muted-foreground">PDFs up to 25 MB</span>
              </div>

              {/* 1. Primary Question Document (Required) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    1. Question Paper Document <span className="text-red-500">*</span>
                  </label>
                  {questionFile && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                      Attached ({ (questionFile.size / 1024 / 1024).toFixed(2) } MB)
                    </Badge>
                  )}
                </div>
                <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer bg-secondary/20">
                  <Upload className="w-6 h-6 text-muted-foreground/60 mb-1" />
                  <p className="text-xs font-medium text-foreground">
                    {questionFile ? questionFile.name : "Click to select primary Question Paper (PDF)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">The actual exam questions sheet</p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={e => handleFileSelect(e, setQuestionFile, "Question Paper")}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 2. Answers / Solutions Document (Optional or AI) */}
              <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    2. Model Answers / Solutions Document (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    {answersFile && (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                        PDF Attached
                      </Badge>
                    )}
                    {aiAnswers && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] cursor-pointer" onClick={() => setAnswersModalOpen(true)}>
                        ✨ AI Answers Ready
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer bg-secondary/20 text-center">
                    <Upload className="w-5 h-5 text-muted-foreground/60 mb-1" />
                    <p className="text-xs font-medium text-foreground truncate max-w-full">
                      {answersFile ? answersFile.name : "Upload Answer PDF"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Prepared solutions document</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={e => handleFileSelect(e, setAnswersFile, "Answers Sheet")}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-col justify-center p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2">
                    <p className="text-xs font-medium text-foreground">Don't have answers?</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isGeneratingAnswers}
                      onClick={handleGenerateAIAnswers}
                      className="text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5 h-8"
                    >
                      {isGeneratingAnswers ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Answers with AI
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 3. Marking Scheme Document (Optional or AI) */}
              <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    3. Marking Scheme / Rubric (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    {markingSchemeFile && (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                        PDF Attached
                      </Badge>
                    )}
                    {aiScheme && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] cursor-pointer" onClick={() => setSchemeModalOpen(true)}>
                        ✨ AI Rubric Ready
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-amber-400/40 transition-colors cursor-pointer bg-secondary/20 text-center">
                    <Upload className="w-5 h-5 text-muted-foreground/60 mb-1" />
                    <p className="text-xs font-medium text-foreground truncate max-w-full">
                      {markingSchemeFile ? markingSchemeFile.name : "Upload Rubric PDF"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Official or department rubric</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={e => handleFileSelect(e, setMarkingSchemeFile, "Marking Scheme")}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-col justify-center p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center space-y-2">
                    <p className="text-xs font-medium text-foreground">Need standard marking criteria?</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isGeneratingScheme}
                      onClick={handleGenerateAIMarkingScheme}
                      className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 h-8"
                    >
                      {isGeneratingScheme ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Marking Scheme with AI
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/past-questions/university")}
                className="border-border/60 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 glow-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {uploadProgress || "Submitting..."}
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Submit for Administrative Review
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* AI Answers Review Dialog */}
        <Dialog open={answersModalOpen} onOpenChange={setAnswersModalOpen}>
          <DialogContent className="glass-card border-border/80 max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI-Generated Model Answers
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review and edit the AI-generated model answers for {courseTitle || "this course"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-2">
              <Textarea
                value={aiAnswers}
                onChange={e => setAiAnswers(e.target.value)}
                className="min-h-[300px] text-xs bg-secondary/30 font-mono leading-relaxed"
                placeholder="AI Answers markdown content..."
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground">This content will be attached to your submission</p>
              <Button
                size="sm"
                onClick={() => {
                  setAnswersModalOpen(false);
                  toast.success("Saved model answers to submission.");
                }}
                className="bg-primary text-primary-foreground text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Save & Attach Answers
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Marking Scheme Review Dialog */}
        <Dialog open={schemeModalOpen} onOpenChange={setSchemeModalOpen}>
          <DialogContent className="glass-card border-border/80 max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                AI-Generated Marking Scheme & Rubric
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review and edit the grading rubric for {courseTitle || "this course"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-2">
              <Textarea
                value={aiScheme}
                onChange={e => setAiScheme(e.target.value)}
                className="min-h-[300px] text-xs bg-secondary/30 font-mono leading-relaxed"
                placeholder="AI Marking Scheme markdown content..."
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground">This rubric will be attached to your submission</p>
              <Button
                size="sm"
                onClick={() => {
                  setSchemeModalOpen(false);
                  toast.success("Saved marking scheme to submission.");
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Save & Attach Rubric
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
