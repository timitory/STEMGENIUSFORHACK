import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MathRenderer } from "@/components/MathRenderer";
import {
  GraduationCap, Plus, Search, Trash2, Eye, Upload, Download,
  CheckCircle2, XCircle, FileSpreadsheet, Sparkles, Filter, Loader2,
  AlertCircle, FileText, BookOpen, Building2, Layers, BookMarked,
  ChevronRight, Library, Settings, Edit3, Globe, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  getExamTypes,
  getInstitutions,
  adminCreatePastQuestion,
  adminDeletePastQuestion,
  adminTogglePublishQuestion,
  generateAIModelAnswer,
  getAcademicProgrammes,
  getExamStructures,
  getUniversityCourses,
  getPastQuestionCollections,
  adminCreateProgramme,
  adminCreateExamStructure,
  adminCreateUniversityCourse,
  adminCreateCollection,
  adminDeleteCollection,
} from "@/lib/pastQuestionsService";
import {
  ExamType,
  Institution,
  PastQuestion,
  AcademicProgramme,
  ExamStructure,
  UniversityCourse,
  PastQuestionCollection,
} from "@/types/pastQuestions";
import SUBJECTED from "@/pages/Subjects";

interface PastQuestionsManagementProps {
  onLogActivity: (action: string, targetType: string, targetId?: string, details?: any) => Promise<void>;
}

// ─── Top-level section tabs ──────────────────────────────────────────────────
type MainTab = "questions" | "university_library" | "user_submissions";

// ─── University Library sub-tabs ─────────────────────────────────────────────
type LibraryTab = "programmes" | "structures" | "courses" | "collections";

export function PastQuestionsManagement({ onLogActivity }: PastQuestionsManagementProps) {
  const [mainTab, setMainTab] = useState<MainTab>("questions");

  // ── Question Bank state ───────────────────────────────────────────────────
  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamFilter, setSelectedExamFilter] = useState("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [selectedFormatFilter, setSelectedFormatFilter] = useState("all");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<PastQuestion | null>(null);

  const [formFormat, setFormFormat] = useState<"mcq" | "theory">("mcq");
  const [formExamTypeId, setFormExamTypeId] = useState("");
  const [formInstitutionId, setFormInstitutionId] = useState<string>("none");
  const [formAcademicLevel, setFormAcademicLevel] = useState<string>("none");
  const [formSubject, setFormSubject] = useState("Mathematics");
  const [formTopic, setFormTopic] = useState("");
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formPaperType, setFormPaperType] = useState("Paper 1");
  const [formDifficulty, setFormDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [formPoints, setFormPoints] = useState<number>(1);
  const [formQuestionText, setFormQuestionText] = useState("");
  const [formDiagramUrl, setFormDiagramUrl] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formModelAnswer, setFormModelAnswer] = useState("");

  // University fields for question creation
  const [formProgrammeId, setFormProgrammeId] = useState<string>("none");
  const [formExamStructureId, setFormExamStructureId] = useState<string>("none");
  const [formCourseId, setFormCourseId] = useState<string>("none");
  const [formCollectionId, setFormCollectionId] = useState<string>("none");
  const [formCourseCode, setFormCourseCode] = useState("");

  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOption, setCorrectOption] = useState<"A" | "B" | "C" | "D">("A");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsed, setBulkParsed] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── University Library state ──────────────────────────────────────────────
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("programmes");
  const [programmes, setProgrammes] = useState<AcademicProgramme[]>([]);
  const [examStructures, setExamStructures] = useState<ExamStructure[]>([]);
  const [universityCourses, setUniversityCourses] = useState<UniversityCourse[]>([]);
  const [collections, setCollections] = useState<PastQuestionCollection[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // ── User Submissions state ────────────────────────────────────────────────
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Programme form
  const [progDialogOpen, setProgDialogOpen] = useState(false);
  const [progFormInstId, setProgFormInstId] = useState("none");
  const [progFormFaculty, setProgFormFaculty] = useState("");
  const [progFormName, setProgFormName] = useState("");
  const [progFormCode, setProgFormCode] = useState("");
  const [progFormDegree, setProgFormDegree] = useState<"undergraduate" | "postgraduate" | "professional">("undergraduate");
  const [progFormSystem, setProgFormSystem] = useState<"block" | "semester" | "trimester" | "annual">("semester");
  const [progFormLevels, setProgFormLevels] = useState("100L,200L,300L,400L,500L");

  // Exam Structure form
  const [structDialogOpen, setStructDialogOpen] = useState(false);
  const [structFormProgId, setStructFormProgId] = useState("none");
  const [structFormInstId, setStructFormInstId] = useState("none");
  const [structFormName, setStructFormName] = useState("");
  const [structFormType, setStructFormType] = useState<"block" | "semester" | "trimester" | "annual" | "professional" | "in_course">("semester");
  const [structFormLevel, setStructFormLevel] = useState("");
  const [structFormOrder, setStructFormOrder] = useState(1);

  // Course form
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseFormInstId, setCourseFormInstId] = useState("none");
  const [courseFormProgId, setCourseFormProgId] = useState("none");
  const [courseFormCode, setCourseFormCode] = useState("");
  const [courseFormTitle, setCourseFormTitle] = useState("");
  const [courseFormLevel, setCourseFormLevel] = useState("");
  const [courseFormStructId, setCourseFormStructId] = useState("none");

  // Collection form
  const [collDialogOpen, setCollDialogOpen] = useState(false);
  const [collFormInstId, setCollFormInstId] = useState("none");
  const [collFormProgId, setCollFormProgId] = useState("none");
  const [collFormStructId, setCollFormStructId] = useState("none");
  const [collFormCourseId, setCollFormCourseId] = useState("none");
  const [collFormTitle, setCollFormTitle] = useState("");
  const [collFormCompiler, setCollFormCompiler] = useState("");
  const [collFormDesc, setCollFormDesc] = useState("");
  const [collFormLevel, setCollFormLevel] = useState("");
  const [collFormSubject, setCollFormSubject] = useState("");
  const [collFormCourseCode, setCollFormCourseCode] = useState("");
  const [collFormStartYear, setCollFormStartYear] = useState<number>(2020);
  const [collFormEndYear, setCollFormEndYear] = useState<number>(new Date().getFullYear());
  const [collFormDocUrl, setCollFormDocUrl] = useState("");
  const [collFormHasAnswers, setCollFormHasAnswers] = useState(true);
  const [collFormHasMarking, setCollFormHasMarking] = useState(true);
  const [collFormAttribution, setCollFormAttribution] = useState("");
  const [collFormPublished, setCollFormPublished] = useState(true);

  // Deduplicate subjects
  const uniqueSubjectsList = useMemo(() => {
    const set = new Set<string>();
    SUBJECTED.forEach((s) => {
      if (s.value && s.value.trim()) set.add(s.value.trim());
    });
    return Array.from(set).sort();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (mainTab === "university_library") {
      loadLibraryData();
    }
    if (mainTab === "user_submissions") {
      loadUserSubmissions();
    }
  }, [mainTab]);

  // ── Question Bank Loaders ─────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [exams, insts, { data: qs, error: qError }] = await Promise.all([
        getExamTypes(),
        getInstitutions(),
        supabase
          .from("past_questions")
          .select("*, exam_types(*), past_question_options(*)")
          .order("created_at", { ascending: false }),
      ]);

      if (qError) throw qError;
      setExamTypes(exams || []);
      setInstitutions(insts || []);
      setQuestions((qs || []) as unknown as PastQuestion[]);

      if (exams && exams.length > 0 && !formExamTypeId) {
        setFormExamTypeId(exams[0].id);
      }
    } catch (err: any) {
      console.error("Error loading questions for admin:", err);
      setLoadError(err.message || "Failed to load past questions");
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  // ── University Library Loaders ────────────────────────────────────────────
  const loadLibraryData = async () => {
    try {
      setLibraryLoading(true);
      setLibraryError(null);
      const [progs, structs, courses, colls] = await Promise.all([
        getAcademicProgrammes(),
        getExamStructures(),
        getUniversityCourses(),
        getPastQuestionCollections(),
      ]);
      setProgrammes(progs);
      setExamStructures(structs);
      setUniversityCourses(courses);
      setCollections(colls);
    } catch (err: any) {
      console.error("Library load error:", err);
      setLibraryError(err.message || "Failed to load university library data");
    } finally {
      setLibraryLoading(false);
    }
  };

  // Reload only collections (after unpublished filter changes)
  const loadAllCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("past_question_collections")
        .select("*, institutions(*), academic_programmes(*), exam_structures(*), university_courses(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCollections((data || []) as unknown as PastQuestionCollection[]);
    } catch (err: any) {
      toast.error("Failed to reload collections: " + err.message);
    }
  };

  // ── User Submissions loader & actions ─────────────────────────────────────
  const loadUserSubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      const { data, error } = await (supabase as any)
        .from("user_submitted_collections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.message?.includes("relation") || error.message?.includes("does not exist")) {
          setSubmissionsError("no_table");
        } else {
          throw error;
        }
        return;
      }
      setUserSubmissions(data || []);
    } catch (err: any) {
      console.error("Submissions load error:", err);
      setSubmissionsError(err.message || "Failed to load submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleReviewSubmission = async () => {
    if (!selectedSubmission) return;
    setIsReviewing(true);
    try {
      const statusMap: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        request_changes: "changes_requested",
      };
      let newStatus = statusMap[reviewAction];

      // If approved, automatically publish to past_question_collections
      if (reviewAction === "approve") {
        let instId: string | null = null;
        if (selectedSubmission.institution_name) {
          const { data: matchedInst } = await supabase
            .from("institutions")
            .select("id")
            .ilike("name", `%${selectedSubmission.institution_name.trim()}%`)
            .limit(1)
            .maybeSingle();

          if (matchedInst) {
            instId = matchedInst.id;
          } else {
            const shortCode = selectedSubmission.institution_name
              .trim()
              .split(/\s+/)
              .map((w: string) => w[0]?.toUpperCase())
              .join("")
              .slice(0, 8) || "INST";

            const { data: newInst } = await supabase
              .from("institutions")
              .insert({
                name: selectedSubmission.institution_name.trim(),
                short_code: shortCode,
                type: "university",
                is_active: true,
              })
              .select("id")
              .maybeSingle();
            if (newInst) instId = newInst.id;
          }
        }

        let progId: string | null = null;
        if (instId && selectedSubmission.programme) {
          const { data: matchedProg } = await supabase
            .from("academic_programmes")
            .select("id")
            .eq("institution_id", instId)
            .ilike("name", `%${selectedSubmission.programme.trim()}%`)
            .limit(1)
            .maybeSingle();

          if (matchedProg) {
            progId = matchedProg.id;
          } else {
            const { data: newProg } = await supabase
              .from("academic_programmes")
              .insert({
                institution_id: instId,
                faculty: selectedSubmission.faculty || "Faculty of Sciences / Medicine",
                name: selectedSubmission.programme.trim(),
                code: selectedSubmission.programme.trim().slice(0, 4).toUpperCase(),
                examination_system: selectedSubmission.exam_period?.toLowerCase().includes("block") ? "block" : "semester",
                is_active: true,
              })
              .select("id")
              .maybeSingle();
            if (newProg) progId = newProg.id;
          }
        }

        // Parse starting year from academic_session (e.g. "2023/2024" -> 2023)
        const yearMatch = selectedSubmission.academic_session?.match(/\d{4}/);
        const startYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

        // Insert into public.past_question_collections
        const { error: publishError } = await supabase
          .from("past_question_collections")
          .insert({
            institution_id: instId,
            programme_id: progId,
            title: selectedSubmission.title,
            compiler_name: selectedSubmission.compiler_name,
            description: selectedSubmission.description,
            academic_level: selectedSubmission.academic_level,
            subject: selectedSubmission.course_title,
            course_code: selectedSubmission.course_code,
            start_year: startYear,
            supported_formats: selectedSubmission.question_formats || ["MCQ", "Theory"],
            document_url: selectedSubmission.document_url,
            answers_document_url: selectedSubmission.answers_document_url,
            marking_scheme_document_url: selectedSubmission.marking_scheme_document_url,
            has_answers: selectedSubmission.has_answers,
            has_marking_scheme: selectedSubmission.has_marking_scheme,
            attribution_info: `Contributed by verified student / compiler: ${selectedSubmission.compiler_name}`,
            is_verified: true,
            is_published: true,
            created_by: selectedSubmission.submitted_by,
          });

        if (publishError) {
          console.error("Error auto-publishing collection:", publishError);
          throw new Error("Failed to auto-publish collection: " + publishError.message);
        }

        newStatus = "published";
      }

      const { error } = await (supabase as any)
        .from("user_submitted_collections")
        .update({
          status: newStatus,
          reviewer_notes: reviewNotes.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedSubmission.id);

      if (error) throw error;
      toast.success(
        reviewAction === "approve"
          ? "Submission approved and published to University Past Questions Library!"
          : `Submission ${newStatus.replace("_", " ")}.`
      );
      setReviewDialogOpen(false);
      setSelectedSubmission(null);
      setReviewNotes("");
      await Promise.all([loadUserSubmissions(), loadCollections()]);
      await onLogActivity("review_submission", "user_submitted_collections", selectedSubmission.id, {
        action: reviewAction,
        status: newStatus,
      });
    } catch (err: any) {
      toast.error("Review failed: " + err.message);
    } finally {
      setIsReviewing(false);
    }
  };
  // ── AI answer generation ──────────────────────────────────────────────────
  const handleGenerateAIAnswer = async () => {
    if (!formQuestionText.trim()) {
      toast.error("Please enter the Question Statement first before generating an AI answer.");
      return;
    }
    setIsGeneratingAI(true);
    toast.loading("Generating comprehensive model answer and marking scheme with AI...");
    try {
      const generated = await generateAIModelAnswer(formQuestionText.trim(), formSubject, formTopic);
      toast.dismiss();
      if (generated) {
        setFormModelAnswer(generated);
        toast.success("AI model answer and marking guide generated!");
      }
    } catch {
      toast.dismiss();
      toast.error("Failed to generate AI answer");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // ── Create question ───────────────────────────────────────────────────────
  const handleCreateQuestion = async () => {
    if (!formExamTypeId || !formSubject.trim() || !formQuestionText.trim()) {
      toast.error("Please fill in Exam Type, Subject, and Question Text");
      return;
    }
    if (formFormat === "mcq") {
      if (!optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
        toast.error("Please provide all 4 options (A, B, C, and D) for MCQ");
        return;
      }
    } else {
      if (!formModelAnswer.trim() && !formExplanation.trim()) {
        toast.error("Please provide a Model Answer / Solution for this Theory question, or click Generate AI Answer.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const qPayload: any = {
        exam_type_id: formExamTypeId,
        institution_id: formInstitutionId !== "none" ? formInstitutionId : null,
        department_id: null,
        academic_level: formAcademicLevel !== "none" ? formAcademicLevel : null,
        subject: formSubject.trim(),
        topic: formTopic.trim() || null,
        subtopic: null,
        year: formYear,
        paper_type: formPaperType,
        question_number: 1,
        question_format: formFormat,
        question_text: formQuestionText.trim(),
        diagram_url: formDiagramUrl.trim() || null,
        explanation: formExplanation.trim() || null,
        model_answer: formFormat === "theory" ? formModelAnswer.trim() || null : null,
        difficulty: formDifficulty,
        points: formFormat === "theory" ? Math.max(1, formPoints) : 1,
        is_verified: true,
        is_published: true,
        created_by: null,
      };

      // University-specific fields
      if (formProgrammeId !== "none") qPayload.programme_id = formProgrammeId;
      if (formExamStructureId !== "none") qPayload.exam_structure_id = formExamStructureId;
      if (formCourseId !== "none") qPayload.course_id = formCourseId;
      if (formCollectionId !== "none") qPayload.collection_id = formCollectionId;
      if (formCourseCode.trim()) qPayload.course_code = formCourseCode.trim();

      const options =
        formFormat === "mcq"
          ? [
              { letter: "A" as const, text: optA.trim(), isCorrect: correctOption === "A" },
              { letter: "B" as const, text: optB.trim(), isCorrect: correctOption === "B" },
              { letter: "C" as const, text: optC.trim(), isCorrect: correctOption === "C" },
              { letter: "D" as const, text: optD.trim(), isCorrect: correctOption === "D" },
            ]
          : undefined;

      const newId = await adminCreatePastQuestion(qPayload, options);
      await onLogActivity("create_question", "past_question", newId, {
        subject: formSubject,
        format: formFormat,
        snippet: formQuestionText.slice(0, 40),
      });

      toast.success(`${formFormat.toUpperCase()} question published successfully!`);
      setFormQuestionText("");
      setFormExplanation("");
      setFormModelAnswer("");
      setFormDiagramUrl("");
      setOptA(""); setOptB(""); setOptC(""); setOptD("");
      setFormProgrammeId("none"); setFormExamStructureId("none");
      setFormCourseId("none"); setFormCollectionId("none"); setFormCourseCode("");
      setCreateDialogOpen(false);
      loadData();
    } catch (err: any) {
      console.error("Error creating question:", err);
      toast.error(err.message || "Failed to create question");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (question: PastQuestion) => {
    try {
      await adminTogglePublishQuestion(question.id, question.is_published);
      toast.success(question.is_published ? "Question unpublished" : "Question published");
      await onLogActivity(
        question.is_published ? "unpublish_question" : "publish_question",
        "past_question",
        question.id,
        { text: question.question_text.slice(0, 40) }
      );
      loadData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm("Are you sure you want to permanently delete this question from the bank?")) return;
    try {
      await adminDeletePastQuestion(questionId);
      toast.success("Question permanently deleted");
      await onLogActivity("delete_question", "past_question", questionId, { deleted: true });
      loadData();
    } catch {
      toast.error("Failed to delete question");
    }
  };

  // ── Bulk upload ───────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];

        if (!data || data.length < 2) {
          setBulkErrors(["File is empty or missing data rows"]);
          return;
        }

        const rows = data.slice(1);
        const parsed: any[] = [];
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const rowNum = i + 2;
          if (!row[0]) return;

          const qText = String(row[0] || "").trim();
          const formatRaw = String(row[1] || "mcq").trim().toLowerCase();
          const format = formatRaw === "theory" ? "theory" : "mcq";
          const a = String(row[2] || "").trim();
          const b = String(row[3] || "").trim();
          const c = String(row[4] || "").trim();
          const d = String(row[5] || "").trim();
          const correct = String(row[6] || "A").trim().toUpperCase();
          const expOrModel = String(row[7] || "").trim();
          const subj = String(row[8] || formSubject || "Mathematics").trim();
          const topic = String(row[9] || "").trim();
          const year = parseInt(row[10] || String(formYear));
          const points = parseInt(row[11] || "1");

          if (!qText) {
            errors.push(`Row ${rowNum}: Missing question text`);
            return;
          }
          if (format === "mcq" && (!a || !b || !c || !d)) {
            errors.push(`Row ${rowNum} (MCQ): Missing one or more options A-D`);
            return;
          }

          parsed.push({
            qText, format, a, b, c, d,
            correct: ["A", "B", "C", "D"].includes(correct) ? correct : "A",
            expOrModel, subj, topic,
            year: isNaN(year) ? formYear : year,
            points: isNaN(points) ? 1 : points,
          });
        });

        setBulkParsed(parsed);
        setBulkErrors(errors);
      } catch {
        setBulkErrors(["Failed to parse Excel file. Ensure valid format."]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteBulkUpload = async () => {
    if (!formExamTypeId) { toast.error("Please select an Examination Type first"); return; }
    if (bulkParsed.length === 0) { toast.error("No valid questions to import"); return; }

    setIsSubmitting(true);
    toast.loading(`Importing ${bulkParsed.length} past questions...`);
    let imported = 0;

    try {
      for (const item of bulkParsed) {
        const isTheory = item.format === "theory";
        await adminCreatePastQuestion(
          {
            exam_type_id: formExamTypeId,
            institution_id: formInstitutionId !== "none" ? formInstitutionId : null,
            department_id: null,
            academic_level: formAcademicLevel !== "none" ? formAcademicLevel : null,
            subject: item.subj, topic: item.topic || null, subtopic: null,
            year: item.year, paper_type: formPaperType, question_number: 1,
            question_format: item.format, question_text: item.qText, diagram_url: null,
            explanation: isTheory ? null : item.expOrModel || null,
            model_answer: isTheory ? item.expOrModel || null : null,
            difficulty: "medium",
            points: isTheory ? Math.max(1, item.points) : 1,
            is_verified: true, is_published: true, created_by: null,
          },
          isTheory
            ? undefined
            : [
                { letter: "A", text: item.a, isCorrect: item.correct === "A" },
                { letter: "B", text: item.b, isCorrect: item.correct === "B" },
                { letter: "C", text: item.c, isCorrect: item.correct === "C" },
                { letter: "D", text: item.d, isCorrect: item.correct === "D" },
              ]
        );
        imported++;
      }
      toast.dismiss();
      toast.success(`Successfully imported ${imported} past questions!`);
      await onLogActivity("bulk_upload_questions", "past_questions", "bulk", { count: imported });
      setBulkUploadOpen(false);
      setBulkParsed([]);
      setBulkFile(null);
      loadData();
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Import failed after ${imported} items: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const wsData = [
      ["Question", "Format (mcq/theory)", "Option A", "Option B", "Option C", "Option D", "Correct (A-D)", "Explanation / Model Answer", "Subject", "Topic", "Year", "Points"],
      ["Find the derivative of y = 3x^2 with respect to x", "mcq", "6x", "3x", "6x^2", "x^2", "A", "Power rule d/dx(ax^n) = n*ax^(n-1) = 2*3x = 6x", "Mathematics", "Calculus", 2023, 1],
      ["State Newton's Second Law of Motion and derive the equation F = ma from first principles.", "theory", "", "", "", "", "", "Newton's second law: F = dp/dt = m(dv/dt) = ma. [2 marks definition, 3 marks derivation]", "Physics", "Mechanics", 2023, 5],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "stem_genius_past_questions_template.xlsx");
    toast.success("Excel template downloaded with MCQ & Theory examples!");
  };

  const filtered = questions.filter((q) => {
    const matchSearch =
      q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchExam = selectedExamFilter === "all" || q.exam_type_id === selectedExamFilter;
    const matchSubject = selectedSubjectFilter === "all" || q.subject === selectedSubjectFilter;
    const matchFormat = selectedFormatFilter === "all" || q.question_format === selectedFormatFilter;
    return matchSearch && matchExam && matchSubject && matchFormat;
  });

  const uniqueSubjectsInBank = Array.from(new Set(questions.map((q) => q.subject))).sort();

  // ── University Library: filtered sub-structures ───────────────────────────
  const filteredStructures = examStructures.filter(
    (s) => structFormProgId === "none" || s.programme_id === structFormProgId
  );
  const filteredCourses = universityCourses.filter(
    (c) => courseFormProgId === "none" || c.programme_id === courseFormProgId
  );
  const formStructures = examStructures.filter(
    (s) => formProgrammeId === "none" || s.programme_id === formProgrammeId
  );
  const formCourses = universityCourses.filter(
    (c) => formProgrammeId === "none" || c.programme_id === formProgrammeId
  );
  const collFormStructures = examStructures.filter(
    (s) => collFormProgId === "none" || s.programme_id === collFormProgId
  );
  const collFormCourses = universityCourses.filter(
    (c) => collFormProgId === "none" || c.programme_id === collFormProgId
  );

  // ── University Library: create handlers ──────────────────────────────────
  const handleCreateProgramme = async () => {
    if (progFormInstId === "none" || !progFormName.trim()) {
      toast.error("Institution and Programme Name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const levels = progFormLevels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      await adminCreateProgramme({
        institution_id: progFormInstId,
        faculty: progFormFaculty.trim() || undefined,
        name: progFormName.trim(),
        code: progFormCode.trim() || undefined,
        degree_type: progFormDegree,
        examination_system: progFormSystem,
        levels,
      });
      toast.success("Programme created successfully!");
      await onLogActivity("create_programme", "academic_programme", undefined, { name: progFormName });
      setProgDialogOpen(false);
      setProgFormInstId("none"); setProgFormFaculty(""); setProgFormName("");
      setProgFormCode(""); setProgFormDegree("undergraduate");
      setProgFormSystem("semester"); setProgFormLevels("100L,200L,300L,400L,500L");
      loadLibraryData();
    } catch (err: any) {
      toast.error("Failed to create programme: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStructure = async () => {
    if (!structFormName.trim()) {
      toast.error("Structure name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminCreateExamStructure({
        programme_id: structFormProgId !== "none" ? structFormProgId : undefined,
        institution_id: structFormInstId !== "none" ? structFormInstId : undefined,
        name: structFormName.trim(),
        structure_type: structFormType,
        academic_level: structFormLevel.trim() || undefined,
        display_order: structFormOrder,
      });
      toast.success("Exam structure created!");
      await onLogActivity("create_exam_structure", "exam_structure", undefined, { name: structFormName });
      setStructDialogOpen(false);
      setStructFormProgId("none"); setStructFormInstId("none");
      setStructFormName(""); setStructFormType("semester");
      setStructFormLevel(""); setStructFormOrder(1);
      loadLibraryData();
    } catch (err: any) {
      toast.error("Failed to create structure: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseFormCode.trim() || !courseFormTitle.trim()) {
      toast.error("Course code and title are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminCreateUniversityCourse({
        institution_id: courseFormInstId !== "none" ? courseFormInstId : undefined,
        programme_id: courseFormProgId !== "none" ? courseFormProgId : undefined,
        code: courseFormCode.trim(),
        title: courseFormTitle.trim(),
        academic_level: courseFormLevel.trim() || undefined,
        exam_structure_id: courseFormStructId !== "none" ? courseFormStructId : undefined,
      });
      toast.success("Course created!");
      await onLogActivity("create_course", "university_course", undefined, { code: courseFormCode });
      setCourseDialogOpen(false);
      setCourseFormInstId("none"); setCourseFormProgId("none");
      setCourseFormCode(""); setCourseFormTitle("");
      setCourseFormLevel(""); setCourseFormStructId("none");
      loadLibraryData();
    } catch (err: any) {
      toast.error("Failed to create course: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCollection = async () => {
    if (collFormInstId === "none" || !collFormTitle.trim() || !collFormCompiler.trim()) {
      toast.error("Institution, Collection Title, and Compiler Name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const newColl = await adminCreateCollection({
        institution_id: collFormInstId,
        programme_id: collFormProgId !== "none" ? collFormProgId : undefined,
        exam_structure_id: collFormStructId !== "none" ? collFormStructId : undefined,
        course_id: collFormCourseId !== "none" ? collFormCourseId : undefined,
        title: collFormTitle.trim(),
        compiler_name: collFormCompiler.trim(),
        description: collFormDesc.trim() || undefined,
        academic_level: collFormLevel.trim() || undefined,
        subject: collFormSubject.trim() || collFormTitle.trim(),
        course_code: collFormCourseCode.trim() || undefined,
        start_year: collFormStartYear,
        end_year: collFormEndYear,
        supported_formats: ["mcq", "theory"],
        document_url: collFormDocUrl.trim() || undefined,
        has_answers: collFormHasAnswers,
        has_marking_scheme: collFormHasMarking,
        attribution_info: collFormAttribution.trim() || undefined,
        is_published: collFormPublished,
      });
      toast.success("Collection created and published!");
      await onLogActivity("create_collection", "past_question_collection", newColl.id, { title: collFormTitle });
      setCollDialogOpen(false);
      setCollFormInstId("none"); setCollFormProgId("none"); setCollFormStructId("none");
      setCollFormCourseId("none"); setCollFormTitle(""); setCollFormCompiler("");
      setCollFormDesc(""); setCollFormLevel(""); setCollFormSubject("");
      setCollFormCourseCode(""); setCollFormStartYear(2020);
      setCollFormEndYear(new Date().getFullYear()); setCollFormDocUrl("");
      setCollFormHasAnswers(true); setCollFormHasMarking(true);
      setCollFormAttribution(""); setCollFormPublished(true);
      loadAllCollections();
    } catch (err: any) {
      toast.error("Failed to create collection: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCollection = async (id: string, title: string) => {
    if (!confirm(`Delete collection "${title}"? This is irreversible.`)) return;
    try {
      await adminDeleteCollection(id);
      toast.success("Collection deleted");
      await onLogActivity("delete_collection", "past_question_collection", id, { title });
      loadAllCollections();
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
  };

  const handleToggleCollectionPublish = async (coll: PastQuestionCollection) => {
    try {
      const { error } = await supabase
        .from("past_question_collections")
        .update({ is_published: !coll.is_published })
        .eq("id", coll.id);
      if (error) throw error;
      toast.success(coll.is_published ? "Collection unpublished" : "Collection published");
      loadAllCollections();
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Top Tab Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border/40 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => setMainTab("questions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mainTab === "questions"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Question Bank
        </button>
        <button
          type="button"
          onClick={() => setMainTab("university_library")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mainTab === "university_library"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Library className="w-4 h-4" />
          University Library
        </button>
        <button
          type="button"
          onClick={() => setMainTab("user_submissions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mainTab === "user_submissions"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="w-4 h-4" />
          User Submissions
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* QUESTION BANK TAB                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "questions" && (
        <>
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-primary" />
                Past Questions Bank Management
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload, review, publish, and delete MCQ & Theory questions with AI model answer generation.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkUploadOpen(true)}
                className="gap-2 text-xs border-border/60"
              >
                <FileSpreadsheet className="w-4 h-4 text-accent" />
                Bulk Import (Excel/CSV)
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold glow-primary"
              >
                <Plus className="w-4 h-4" />
                Add New Question
              </Button>
            </div>
          </div>

          {loadError && (
            <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{loadError}</span>
              </div>
              <Button size="sm" variant="outline" onClick={loadData} className="h-7 text-xs">
                Retry
              </Button>
            </Card>
          )}

          {/* Filter Bar */}
          <Card className="p-4 glass-card border-border/60 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search questions by text, subject, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-secondary/50 border-border/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={selectedFormatFilter} onValueChange={setSelectedFormatFilter}>
                <SelectTrigger className="w-32 h-9 text-xs bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="mcq">MCQ Only</SelectItem>
                  <SelectItem value="theory">Theory Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedExamFilter} onValueChange={setSelectedExamFilter}>
                <SelectTrigger className="w-40 h-9 text-xs bg-secondary/50 border-border/50">
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Examinations</SelectItem>
                  {examTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                <SelectTrigger className="w-40 h-9 text-xs bg-secondary/50 border-border/50">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {uniqueSubjectsInBank.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Questions List */}
          <Card className="glass-card border-border/60 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading questions...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No questions found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a new question or import past papers via Excel template.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          {q.exam_types?.name || "Exam"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{q.subject}</Badge>
                        <Badge
                          className={`text-[9px] uppercase font-bold ${
                            q.question_format === "theory"
                              ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                              : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {q.question_format === "theory" ? "Theory / Structured" : "MCQ"}
                        </Badge>
                        {q.topic && <span className="text-[11px] text-muted-foreground">• {q.topic}</span>}
                        <span className="text-[11px] text-muted-foreground font-mono">({q.year})</span>
                        {q.is_published ? (
                          <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px]">Published</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">Draft</Badge>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-foreground line-clamp-2">
                        <MathRenderer content={q.question_text} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setPreviewQuestion(q)}
                        className="h-8 text-xs gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleTogglePublish(q)}
                        className="h-8 text-xs border-border/50"
                      >
                        {q.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => handleDelete(q.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 p-0"
                        title="Delete Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* UNIVERSITY LIBRARY TAB                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "university_library" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Library className="w-6 h-6 text-primary" />
                University Examination Library
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage programmes, exam structures, courses, and curated past question collections.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={loadLibraryData}
              disabled={libraryLoading}
              className="gap-2 text-xs border-border/60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${libraryLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {libraryError && (
            <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{libraryError}</span>
            </Card>
          )}

          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/50 border border-border/40">
            {(["programmes", "structures", "courses", "collections"] as LibraryTab[]).map((tab) => {
              const icons: Record<LibraryTab, React.ReactNode> = {
                programmes: <BookOpen className="w-3.5 h-3.5" />,
                structures: <Layers className="w-3.5 h-3.5" />,
                courses: <BookMarked className="w-3.5 h-3.5" />,
                collections: <FileText className="w-3.5 h-3.5" />,
              };
              const labels: Record<LibraryTab, string> = {
                programmes: "Programmes",
                structures: "Exam Structures",
                courses: "Courses",
                collections: "Collections",
              };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLibraryTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    libraryTab === tab
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {icons[tab]}
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {libraryLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading library data...</p>
            </div>
          ) : (
            <>
              {/* ── PROGRAMMES ─────────────────────────────────────────────── */}
              {libraryTab === "programmes" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setProgDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground text-xs glow-primary">
                      <Plus className="w-4 h-4" /> Add Programme
                    </Button>
                  </div>
                  <Card className="glass-card border-border/60 overflow-hidden">
                    {programmes.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground text-xs">
                        No programmes yet. Add one to get started.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {programmes.map((p) => (
                          <div key={p.id} className="p-4 flex items-start gap-4 hover:bg-secondary/20">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-foreground">{p.name}</span>
                                {p.code && <Badge variant="outline" className="text-[10px]">{p.code}</Badge>}
                                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                  {p.examination_system}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">{p.degree_type}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{p.institutions?.name}</p>
                              {p.faculty && <p className="text-[11px] text-muted-foreground">Faculty: {p.faculty}</p>}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(p.levels || []).map((l) => (
                                  <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{l}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── EXAM STRUCTURES ────────────────────────────────────────── */}
              {libraryTab === "structures" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setStructDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground text-xs glow-primary">
                      <Plus className="w-4 h-4" /> Add Exam Structure
                    </Button>
                  </div>
                  <Card className="glass-card border-border/60 overflow-hidden">
                    {examStructures.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground text-xs">
                        No exam structures yet. Add one to get started.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {examStructures.map((s) => (
                          <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-secondary/20">
                            <div className="p-2 rounded-lg bg-accent/10">
                              <Layers className="w-4 h-4 text-accent" />
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">{s.name}</span>
                                <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">{s.structure_type}</Badge>
                                {s.academic_level && <Badge variant="outline" className="text-[10px]">{s.academic_level}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {s.academic_programmes?.name || "All Programmes"} • Order: {s.display_order}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── COURSES ────────────────────────────────────────────────── */}
              {libraryTab === "courses" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setCourseDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground text-xs glow-primary">
                      <Plus className="w-4 h-4" /> Add Course
                    </Button>
                  </div>
                  <Card className="glass-card border-border/60 overflow-hidden">
                    {universityCourses.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground text-xs">
                        No courses yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {universityCourses.map((c) => (
                          <div key={c.id} className="p-4 flex items-center gap-4 hover:bg-secondary/20">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <BookMarked className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-xs text-accent">{c.code}</span>
                                <span className="font-semibold text-sm text-foreground">{c.title}</span>
                                {c.academic_level && <Badge variant="outline" className="text-[10px]">{c.academic_level}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.academic_programmes?.name || "—"} {c.exam_structures?.name ? `• ${c.exam_structures.name}` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── COLLECTIONS ────────────────────────────────────────────── */}
              {libraryTab === "collections" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setCollDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground text-xs glow-primary">
                      <Plus className="w-4 h-4" /> Add Collection
                    </Button>
                  </div>
                  <Card className="glass-card border-border/60 overflow-hidden">
                    {collections.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground text-xs">
                        No collections yet. Add a curated past question compilation.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {collections.map((coll) => (
                          <div key={coll.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-secondary/20">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">{coll.title}</span>
                                {coll.is_published ? (
                                  <Badge className="text-[9px] bg-primary/15 text-primary border-primary/20">Published</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">Draft</Badge>
                                )}
                                {coll.has_answers && <Badge className="text-[9px] bg-green-500/15 text-green-400 border-green-500/20">Answers</Badge>}
                                {coll.has_marking_scheme && <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/20">Marking</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Compiled by <span className="font-medium text-foreground">{coll.compiler_name}</span>
                                {coll.subject ? ` • ${coll.subject}` : ""}
                                {coll.course_code ? ` (${coll.course_code})` : ""}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {coll.institutions?.name}
                                {coll.academic_programmes?.name ? ` → ${coll.academic_programmes.name}` : ""}
                                {coll.academic_level ? ` • ${coll.academic_level}` : ""}
                                {coll.start_year ? ` • ${coll.start_year}–${coll.end_year || "present"}` : ""}
                              </p>
                              {coll.document_url && (
                                <a
                                  href={coll.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary underline underline-offset-2"
                                >
                                  View Document ↗
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm" variant="outline"
                                onClick={() => handleToggleCollectionPublish(coll)}
                                className="h-8 text-xs border-border/50"
                              >
                                {coll.is_published ? "Unpublish" : "Publish"}
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleDeleteCollection(coll.id, coll.title)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 p-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* USER SUBMISSIONS TAB                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "user_submissions" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Upload className="w-6 h-6 text-primary" />
                User-Submitted Past Questions
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review, approve or reject past question documents submitted by students.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={loadUserSubmissions}
              disabled={submissionsLoading}
              className="gap-2 text-xs border-border/60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${submissionsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {submissionsError === "no_table" ? (
            <Card className="p-8 border-border/60 glass-card text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">Submissions table not set up yet.</p>
              <p className="text-xs text-muted-foreground/60">
                Run the SQL from the setup guide in Supabase Dashboard to create the user_submitted_collections table.
              </p>
            </Card>
          ) : submissionsError ? (
            <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {submissionsError}
            </Card>
          ) : submissionsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading submissions...</p>
            </div>
          ) : userSubmissions.length === 0 ? (
            <Card className="p-10 border-border/60 glass-card text-center space-y-2">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No submissions found.</p>
              <p className="text-xs text-muted-foreground/60">Student submissions will appear here for review.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {userSubmissions.map((sub) => {
                const statusColors: Record<string, string> = {
                  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                  changes_requested: "bg-orange-500/20 text-orange-400 border-orange-500/30",
                  approved: "bg-green-500/20 text-green-400 border-green-500/30",
                  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
                  published: "bg-primary/20 text-primary border-primary/30",
                  draft: "bg-secondary/60 text-muted-foreground border-border/40",
                };
                const statusColor = statusColors[sub.status] || statusColors.draft;
                return (
                  <Card key={sub.id} className="p-5 glass-card border-border/60 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground">{sub.title}</h3>
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                            {sub.status?.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {sub.institution_name}
                          {sub.programme && ` · ${sub.programme}`}
                          {sub.course_code && ` · ${sub.course_code}`}
                          {sub.course_title && ` — ${sub.course_title}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          Compiler: {sub.compiler_name} · Session: {sub.academic_session}
                          {sub.exam_period && ` · ${sub.exam_period}`}
                          {sub.academic_level && ` · ${sub.academic_level}`}
                        </p>
                        {sub.reviewer_notes && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Review note: {sub.reviewer_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sub.document_url && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => {
                              supabase.storage.from("past-question-pdfs")
                                .createSignedUrl(sub.document_url, 3600)
                                .then(({ data }) => {
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                  else toast.error("Could not generate preview URL");
                                });
                            }}
                            className="text-xs h-8 gap-1.5 border-border/60"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview PDF
                          </Button>
                        )}
                        {(sub.status === "pending" || sub.status === "changes_requested" || sub.status === "approved") && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setReviewAction("approve");
                              setReviewNotes(sub.reviewer_notes || "");
                              setReviewDialogOpen(true);
                            }}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS                                                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* ── CREATE QUESTION DIALOG ─────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add Past Examination Question
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Supports Multiple Choice (MCQ) and Theory questions with step-by-step solutions or AI-generated model answers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Format Toggle */}
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-secondary/50 border border-border/40">
              <button
                type="button"
                onClick={() => setFormFormat("mcq")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formFormat === "mcq" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Multiple Choice (MCQ)
              </button>
              <button
                type="button"
                onClick={() => setFormFormat("theory")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formFormat === "theory" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Structured / Theory Question
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">Examination Body *</label>
                <Select value={formExamTypeId} onValueChange={setFormExamTypeId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Exam" /></SelectTrigger>
                  <SelectContent>
                    {examTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">Subject *</label>
                <Select value={formSubject} onValueChange={setFormSubject}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {uniqueSubjectsList.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">Topic (Optional)</label>
                <Input
                  placeholder="e.g. Differentiation, Ohm's Law"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="bg-secondary/40 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Year *</label>
                  <Input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="bg-secondary/40 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Points</label>
                  <Input
                    type="number"
                    value={formPoints}
                    onChange={(e) => setFormPoints(parseInt(e.target.value) || 1)}
                    className="bg-secondary/40 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Difficulty</label>
                  <Select value={formDifficulty} onValueChange={(v: any) => setFormDifficulty(v)}>
                    <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* University-specific fields — shown when exam type is UNIVERSITY or always available as optional */}
            <details className="border border-border/40 rounded-lg">
              <summary className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none flex items-center gap-2">
                <Library className="w-3.5 h-3.5" />
                University Library Linkage (Optional — for university programme questions)
              </summary>
              <div className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Programme</label>
                  <Select value={formProgrammeId} onValueChange={(v) => { setFormProgrammeId(v); setFormExamStructureId("none"); setFormCourseId("none"); }}>
                    <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {programmes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Exam Structure</label>
                  <Select value={formExamStructureId} onValueChange={setFormExamStructureId}>
                    <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {formStructures.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Course</label>
                  <Select value={formCourseId} onValueChange={setFormCourseId}>
                    <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {formCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Collection</label>
                  <Select value={formCollectionId} onValueChange={setFormCollectionId}>
                    <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {collections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Course Code</label>
                  <Input
                    placeholder="e.g. ANA 201"
                    value={formCourseCode}
                    onChange={(e) => setFormCourseCode(e.target.value)}
                    className="bg-secondary/40 text-xs"
                  />
                </div>
              </div>
            </details>

            {/* Question Text */}
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Question Statement (LaTeX math supported) *
              </label>
              <Textarea
                placeholder="Enter complete question statement..."
                value={formQuestionText}
                onChange={(e) => setFormQuestionText(e.target.value)}
                className="bg-secondary/40 text-xs min-h-[90px]"
              />
              {formQuestionText && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/30 border border-border/40">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Live Math Preview:</span>
                  <MathRenderer content={formQuestionText} />
                </div>
              )}
            </div>

            {/* Diagram URL */}
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">Diagram / Image URL (Optional)</label>
              <Input
                placeholder="https://.../circuit-diagram.png"
                value={formDiagramUrl}
                onChange={(e) => setFormDiagramUrl(e.target.value)}
                className="bg-secondary/40 text-xs"
              />
            </div>

            {/* MCQ Options */}
            {formFormat === "mcq" ? (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <label className="text-xs text-muted-foreground font-semibold block">
                  Answer Options (Select the correct option) *
                </label>
                {[
                  { letter: "A", val: optA, set: setOptA },
                  { letter: "B", val: optB, set: setOptB },
                  { letter: "C", val: optC, set: setOptC },
                  { letter: "D", val: optD, set: setOptD },
                ].map((opt) => (
                  <div key={opt.letter} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOption === opt.letter}
                      onChange={() => setCorrectOption(opt.letter as any)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="font-bold text-xs text-foreground w-4">{opt.letter}.</span>
                    <Input
                      placeholder={`Option ${opt.letter} text...`}
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      className="bg-secondary/40 text-xs flex-1"
                    />
                  </div>
                ))}
                <div className="pt-2">
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Detailed Solution & Explanation</label>
                  <Textarea
                    placeholder="Step-by-step working, formula used, or rationale..."
                    value={formExplanation}
                    onChange={(e) => setFormExplanation(e.target.value)}
                    className="bg-secondary/40 text-xs min-h-[70px]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-foreground font-bold block">Model Answer & Marking Guide *</label>
                    <p className="text-[11px] text-muted-foreground">Include complete solution derivations and mark distribution.</p>
                  </div>
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={handleGenerateAIAnswer}
                    disabled={isGeneratingAI || !formQuestionText.trim()}
                    className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 glow-primary"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    {isGeneratingAI ? "Generating..." : "Generate AI Model Answer"}
                  </Button>
                </div>
                <Textarea
                  placeholder="Type official model answer, or click 'Generate AI Model Answer'..."
                  value={formModelAnswer}
                  onChange={(e) => setFormModelAnswer(e.target.value)}
                  className="bg-secondary/40 text-xs min-h-[140px] font-mono leading-relaxed"
                />
                {formModelAnswer && (
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Rendered Answer Preview:</span>
                    <MathRenderer content={formModelAnswer} />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-border/60 text-xs">Cancel</Button>
            <Button
              onClick={handleCreateQuestion} disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Publish {formFormat === "theory" ? "Theory Question" : "MCQ Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK UPLOAD DIALOG ─────────────────────────────────────────── */}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="glass-card border-border/80 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              Bulk Import Past Questions (MCQ & Theory)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Upload an Excel (.xlsx) or CSV file with MCQ questions or Theory questions with model answers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/40">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">Download Spreadsheet Template</span>
                <p className="text-[11px] text-muted-foreground">Pre-formatted with both MCQ and Theory columns.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs border-border/60">
                <Download className="w-3.5 h-3.5 text-accent" /> Template
              </Button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">Assign to Examination Body *</label>
              <Select value={formExamTypeId} onValueChange={setFormExamTypeId}>
                <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Exam" /></SelectTrigger>
                <SelectContent>
                  {examTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center space-y-2">
              <Upload className="w-8 h-8 text-primary mx-auto" />
              <p className="text-xs font-medium text-foreground">
                {bulkFile ? bulkFile.name : "Select .xlsx or .csv file to import"}
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} className="text-xs">
                Browse Files
              </Button>
            </div>
            {bulkParsed.length > 0 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                ✓ Successfully parsed {bulkParsed.length} questions from file ({bulkParsed.filter((p) => p.format === "theory").length} Theory, {bulkParsed.filter((p) => p.format === "mcq").length} MCQ).
              </div>
            )}
            {bulkErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                {bulkErrors.slice(0, 3).map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkUploadOpen(false)} className="border-border/60 text-xs">Cancel</Button>
            <Button
              onClick={handleExecuteBulkUpload} disabled={isSubmitting || bulkParsed.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Import {bulkParsed.length} Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QUESTION PREVIEW DIALOG ────────────────────────────────────── */}
      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="glass-card border-border/80 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-between">
              <span>Question Preview</span>
              {previewQuestion && (
                <Badge variant="outline" className="text-xs uppercase">
                  {previewQuestion.question_format === "theory" ? "Theory / Structured" : "MCQ"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4 py-2">
              <div className="text-sm font-medium text-foreground">
                <MathRenderer content={previewQuestion.question_text} />
              </div>
              {previewQuestion.question_format === "theory" ? (
                <div className="p-3 rounded-lg bg-secondary/50 border border-purple-500/20 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Model Answer & Marking Guide:
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{previewQuestion.points || 5} Points</Badge>
                  </div>
                  <MathRenderer content={previewQuestion.model_answer || previewQuestion.explanation || "No model answer provided."} />
                </div>
              ) : (
                <div className="space-y-2">
                  {previewQuestion.past_question_options?.map((opt) => (
                    <div
                      key={opt.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                        opt.is_correct
                          ? "bg-primary/15 border-primary text-primary font-semibold"
                          : "border-border/40 text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold">{opt.option_letter}.</span>
                      <MathRenderer content={opt.option_text} />
                    </div>
                  ))}
                  {previewQuestion.explanation && (
                    <div className="p-3 rounded-lg bg-secondary/50 border border-primary/20 text-xs space-y-1 mt-2">
                      <span className="font-bold text-accent">Explanation:</span>
                      <MathRenderer content={previewQuestion.explanation} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD PROGRAMME DIALOG ───────────────────────────────────────── */}
      <Dialog open={progDialogOpen} onOpenChange={setProgDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Add Academic Programme
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new programme (e.g. MBBS, BDS, BSc Computer Science) for an institution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Institution *</label>
              <Select value={progFormInstId} onValueChange={setProgFormInstId}>
                <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Institution" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select Institution</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Faculty / College / School (Optional)</label>
              <Input placeholder="e.g. College of Medicine, Faculty of Sciences" value={progFormFaculty} onChange={(e) => setProgFormFaculty(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Programme Name *</label>
                <Input placeholder="e.g. MBBS, BDS, BSc Computer Science" value={progFormName} onChange={(e) => setProgFormName(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Programme Code</label>
                <Input placeholder="e.g. MBBS, CSC" value={progFormCode} onChange={(e) => setProgFormCode(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Degree Type</label>
                <Select value={progFormDegree} onValueChange={(v: any) => setProgFormDegree(v)}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="undergraduate">Undergraduate</SelectItem>
                    <SelectItem value="postgraduate">Postgraduate</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Examination System</label>
                <Select value={progFormSystem} onValueChange={(v: any) => setProgFormSystem(v)}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="semester">Semester</SelectItem>
                    <SelectItem value="trimester">Trimester</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Academic Levels (comma-separated)</label>
              <Input placeholder="100L,200L,300L,400L,500L" value={progFormLevels} onChange={(e) => setProgFormLevels(e.target.value)} className="bg-secondary/40 text-xs font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleCreateProgramme} disabled={isSubmitting} className="bg-primary text-primary-foreground text-xs">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Create Programme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD EXAM STRUCTURE DIALOG ──────────────────────────────────── */}
      <Dialog open={structDialogOpen} onOpenChange={setStructDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" /> Add Exam Structure
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              e.g. Block 1, First Semester, Part I Professional Examination
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Programme (Optional)</label>
              <Select value={structFormProgId} onValueChange={setStructFormProgId}>
                <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="All Programmes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Programmes</SelectItem>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Institution (Optional)</label>
              <Select value={structFormInstId} onValueChange={setStructFormInstId}>
                <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="All Institutions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Institutions</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Structure Name *</label>
              <Input placeholder="e.g. Block 1, First Semester, Part I Professional Exam" value={structFormName} onChange={(e) => setStructFormName(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Structure Type</label>
                <Select value={structFormType} onValueChange={(v: any) => setStructFormType(v)}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="semester">Semester</SelectItem>
                    <SelectItem value="trimester">Trimester</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="in_course">In-Course</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Academic Level</label>
                <Input placeholder="e.g. 100L, 200L" value={structFormLevel} onChange={(e) => setStructFormLevel(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Display Order</label>
                <Input type="number" value={structFormOrder} onChange={(e) => setStructFormOrder(parseInt(e.target.value) || 1)} className="bg-secondary/40 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStructDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleCreateStructure} disabled={isSubmitting} className="bg-primary text-primary-foreground text-xs">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Create Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD COURSE DIALOG ─────────────────────────────────────────── */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-purple-400" /> Add University Course
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              e.g. ANA 201 — Human Anatomy, BCH 201 — Biochemistry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Institution</label>
                <Select value={courseFormInstId} onValueChange={setCourseFormInstId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Institution" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Programme</label>
                <Select value={courseFormProgId} onValueChange={setCourseFormProgId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Programme" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Course Code *</label>
                <Input placeholder="e.g. ANA 201" value={courseFormCode} onChange={(e) => setCourseFormCode(e.target.value)} className="bg-secondary/40 text-xs font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Academic Level</label>
                <Input placeholder="e.g. 200L, 300L" value={courseFormLevel} onChange={(e) => setCourseFormLevel(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Course Title *</label>
              <Input placeholder="e.g. Human Anatomy, General Biochemistry" value={courseFormTitle} onChange={(e) => setCourseFormTitle(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Exam Structure</label>
              <Select value={courseFormStructId} onValueChange={setCourseFormStructId}>
                <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Structure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredCourses.length > 0 ? examStructures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  )) : examStructures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleCreateCourse} disabled={isSubmitting} className="bg-primary text-primary-foreground text-xs">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD COLLECTION DIALOG ─────────────────────────────────────── */}
      <Dialog open={collDialogOpen} onOpenChange={setCollDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Add Past Question Collection
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a curated compilation (e.g. Shuiyebo's Anatomy Past Questions, LASUCOM Physiology).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Institution *</label>
                <Select value={collFormInstId} onValueChange={setCollFormInstId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Institution" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Institution</SelectItem>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Programme</label>
                <Select value={collFormProgId} onValueChange={(v) => { setCollFormProgId(v); setCollFormStructId("none"); setCollFormCourseId("none"); }}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Programme" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Exam Structure</label>
                <Select value={collFormStructId} onValueChange={setCollFormStructId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Structure" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {collFormStructures.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Course</label>
                <Select value={collFormCourseId} onValueChange={setCollFormCourseId}>
                  <SelectTrigger className="bg-secondary/40 text-xs"><SelectValue placeholder="Select Course" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {collFormCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Collection Title *</label>
              <Input placeholder="e.g. Shuiyebo's Anatomy Past Questions, LASUCOM Physiology MCQ Bank" value={collFormTitle} onChange={(e) => setCollFormTitle(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Compiler / Author Name *</label>
              <Input placeholder="e.g. Shuiyebo, Dr. Adeyemi, NACOS 2024" value={collFormCompiler} onChange={(e) => setCollFormCompiler(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
              <Textarea placeholder="Brief description of this collection..." value={collFormDesc} onChange={(e) => setCollFormDesc(e.target.value)} className="bg-secondary/40 text-xs min-h-[70px]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Academic Level</label>
                <Input placeholder="e.g. 200L" value={collFormLevel} onChange={(e) => setCollFormLevel(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Subject / Course Name</label>
                <Input placeholder="e.g. Anatomy" value={collFormSubject} onChange={(e) => setCollFormSubject(e.target.value)} className="bg-secondary/40 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Course Code</label>
                <Input placeholder="e.g. ANA 201" value={collFormCourseCode} onChange={(e) => setCollFormCourseCode(e.target.value)} className="bg-secondary/40 text-xs font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Start Year</label>
                <Input type="number" value={collFormStartYear} onChange={(e) => setCollFormStartYear(parseInt(e.target.value) || 2020)} className="bg-secondary/40 text-xs" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Document URL (Google Drive / Supabase / GitHub Raw)</label>
              <Input placeholder="https://drive.google.com/file/... or https://..." value={collFormDocUrl} onChange={(e) => setCollFormDocUrl(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Attribution & Copyright Info</label>
              <Input placeholder="Original compiler, source, permissions..." value={collFormAttribution} onChange={(e) => setCollFormAttribution(e.target.value)} className="bg-secondary/40 text-xs" />
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={collFormHasAnswers}
                  onChange={(e) => setCollFormHasAnswers(e.target.checked)}
                  className="w-4 h-4"
                />
                Has Model Answers
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={collFormHasMarking}
                  onChange={(e) => setCollFormHasMarking(e.target.checked)}
                  className="w-4 h-4"
                />
                Has Marking Scheme
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={collFormPublished}
                  onChange={(e) => setCollFormPublished(e.target.checked)}
                  className="w-4 h-4"
                />
                Publish Immediately
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleCreateCollection} disabled={isSubmitting} className="bg-primary text-primary-foreground text-xs font-semibold glow-primary">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── REVIEW SUBMISSION DIALOG ──────────────────────────────────────── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Review Submission</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedSubmission?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1.5">Decision</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "approve", label: "Approve", cls: "border-green-500/50 text-green-400 bg-green-500/10" },
                  { key: "reject", label: "Reject", cls: "border-red-500/50 text-red-400 bg-red-500/10" },
                  { key: "request_changes", label: "Request Changes", cls: "border-orange-500/50 text-orange-400 bg-orange-500/10" },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReviewAction(key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      reviewAction === key ? cls : "border-border/40 text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                Notes for Submitter (Optional)
              </label>
              <Textarea
                placeholder="Provide a reason or feedback for the submitter..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="bg-secondary/40 text-xs min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmission}
              disabled={isReviewing}
              className="bg-primary text-primary-foreground text-xs font-semibold"
            >
              {isReviewing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
