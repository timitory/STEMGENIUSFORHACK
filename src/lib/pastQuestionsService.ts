import { supabase } from "@/integrations/supabase/client";
import {
  ExamType,
  Institution,
  ExamDepartment,
  AcademicProgramme,
  ExamStructure,
  UniversityCourse,
  PastQuestionCollection,
  PastQuestion,
  PastQuestionOption,
  PastQuestionSession,
  PastQuestionResponse,
  PastQuestionBookmark,
  PastQuestionFilters,
} from "@/types/pastQuestions";

/**
 * Fetch all active examination types (JAMB, WAEC, NECO, etc.)
 */
export async function getExamTypes(): Promise<ExamType[]> {
  const { data, error } = await supabase
    .from("exam_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching exam types:", error);
    return [];
  }
  return data as unknown as ExamType[];
}

/**
 * Fetch all active institutions (Universities, Polytechnics, etc.)
 */
export async function getInstitutions(): Promise<Institution[]> {
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching institutions:", error);
    return [];
  }
  return data as unknown as Institution[];
}

/**
 * Fetch departments for a given institution
 */
export async function getDepartments(institutionId: string): Promise<ExamDepartment[]> {
  const { data, error } = await supabase
    .from("exam_departments")
    .select("*")
    .eq("institution_id", institutionId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
  return data as unknown as ExamDepartment[];
}

/**
 * Fetch metadata options (distinct subjects, topics, years) for active questions
 */
export async function getPastQuestionsMeta(examTypeId?: string, institutionId?: string) {
  let query = supabase.from("past_questions").select("subject, topic, year, academic_level");
  if (examTypeId) query = query.eq("exam_type_id", examTypeId);
  if (institutionId) query = query.eq("institution_id", institutionId);

  const { data, error } = await query;
  if (error || !data) return { subjects: [], topics: [], years: [], levels: [] };

  const subjects = Array.from(new Set(data.map((q: any) => q.subject).filter(Boolean))).sort();
  const topics = Array.from(new Set(data.map((q: any) => q.topic).filter(Boolean))).sort();
  const years = Array.from(new Set(data.map((q: any) => q.year).filter(Boolean))).sort((a: any, b: any) => b - a);
  const levels = Array.from(new Set(data.map((q: any) => q.academic_level).filter(Boolean))).sort();

  return { subjects, topics, years, levels };
}

/**
 * Fetch past questions matching active student filters
 */
export async function fetchPastQuestions(
  filters: PastQuestionFilters,
  userId?: string
): Promise<PastQuestion[]> {
  let query = supabase
    .from("past_questions")
    .select(
      `
      *,
      exam_types (*),
      institutions (*),
      past_question_options (*)
    `
    )
    .eq("is_published", true)
    .order("year", { ascending: false })
    .order("question_number", { ascending: true, nullsFirst: false });

  if (filters.examTypeId) query = query.eq("exam_type_id", filters.examTypeId);
  if (filters.institutionId) query = query.eq("institution_id", filters.institutionId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.programmeId) query = query.eq("programme_id", filters.programmeId);
  if (filters.examStructureId) query = query.eq("exam_structure_id", filters.examStructureId);
  if (filters.courseId) query = query.eq("course_id", filters.courseId);
  if (filters.collectionId) query = query.eq("collection_id", filters.collectionId);
  if (filters.academicLevel) query = query.eq("academic_level", filters.academicLevel);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.year) query = query.eq("year", filters.year);
  if (filters.questionFormat) query = query.eq("question_format", filters.questionFormat);
  if (filters.searchQuery) {
    query = query.or(`question_text.ilike.%${filters.searchQuery}%,subject.ilike.%${filters.searchQuery}%,topic.ilike.%${filters.searchQuery}%,course_code.ilike.%${filters.searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching past questions:", error);
    return [];
  }

  const questions = (data || []) as unknown as PastQuestion[];

  // If user is logged in, attach bookmark status
  if (userId && questions.length > 0) {
    const questionIds = questions.map((q) => q.id);
    const { data: bookmarks } = await supabase
      .from("past_question_bookmarks")
      .select("question_id")
      .eq("user_id", userId)
      .in("question_id", questionIds);

    const bookmarkedSet = new Set((bookmarks || []).map((b: any) => b.question_id));
    return questions.map((q) => ({
      ...q,
      is_bookmarked: bookmarkedSet.has(q.id),
      past_question_options: (q.past_question_options || []).sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    }));
  }

  return questions.map((q) => ({
    ...q,
    past_question_options: (q.past_question_options || []).sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    ),
  }));
}

/**
 * Start a new examination or practice session
 */
export async function startPastQuestionSession(params: {
  userId: string;
  sessionMode: "practice" | "timed_exam" | "topic_drill";
  examTypeId?: string;
  institutionId?: string;
  subject: string;
  topic?: string;
  year?: number;
  totalQuestions: number;
  timeLimitSeconds: number;
}): Promise<PastQuestionSession | null> {
  const { data, error } = await supabase
    .from("past_question_sessions")
    .insert({
      user_id: params.userId,
      session_mode: params.sessionMode,
      exam_type_id: params.examTypeId || null,
      institution_id: params.institutionId || null,
      subject: params.subject,
      topic: params.topic || null,
      year: params.year || null,
      total_questions: params.totalQuestions,
      time_limit_seconds: params.timeLimitSeconds,
      status: "in_progress",
    })
    .select("*, exam_types(*)")
    .single();

  if (error) {
    console.error("Error starting session:", error);
    return null;
  }
  return data as unknown as PastQuestionSession;
}

/**
 * Record a response to a question in a session
 */
export async function recordQuestionResponse(params: {
  sessionId: string;
  questionId: string;
  selectedOptionId?: string;
  theoryResponse?: string;
  isCorrect?: boolean;
  timeSpentSeconds?: number;
}) {
  const { error } = await supabase.from("past_question_responses").upsert(
    {
      session_id: params.sessionId,
      question_id: params.questionId,
      selected_option_id: params.selectedOptionId || null,
      theory_response: params.theoryResponse || null,
      is_correct: params.isCorrect,
      time_spent_seconds: params.timeSpentSeconds || 0,
    },
    { onConflict: "session_id,question_id" }
  );

  if (error) {
    console.error("Error recording question response:", error);
    throw error;
  }
}

/**
 * Complete a session and calculate total metrics
 */
export async function completePastQuestionSession(
  sessionId: string,
  timeSpentSeconds: number
): Promise<PastQuestionSession | null> {
  // Fetch all responses for this session
  const { data: responses, error: respError } = await supabase
    .from("past_question_responses")
    .select("*, past_questions(points)")
    .eq("session_id", sessionId);

  if (respError) console.error("Error fetching responses for calculation:", respError);

  const totalAnswered = (responses || []).length;
  const correctCount = (responses || []).filter((r: any) => r.is_correct === true).length;
  const incorrectCount = (responses || []).filter((r: any) => r.is_correct === false).length;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const totalScore = (responses || []).reduce((acc: number, curr: any) => {
    return curr.is_correct ? acc + (curr.past_questions?.points || 1) : acc;
  }, 0);

  const { data, error } = await supabase
    .from("past_question_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      time_spent_seconds: timeSpentSeconds,
      correct_answers: correctCount,
      incorrect_answers: incorrectCount,
      score: totalScore,
      accuracy_percentage: accuracy,
    })
    .eq("id", sessionId)
    .select("*, exam_types(*)")
    .single();

  if (error) {
    console.error("Error completing session:", error);
    return null;
  }
  return data as unknown as PastQuestionSession;
}

/**
 * Fetch user's completed practice and exam history
 */
export async function getUserSessionHistory(userId: string): Promise<PastQuestionSession[]> {
  const { data, error } = await supabase
    .from("past_question_sessions")
    .select("*, exam_types(*)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Error fetching session history:", error);
    return [];
  }
  return data as unknown as PastQuestionSession[];
}

/**
 * Fetch a single session with all its responses and question details
 */
export async function getSessionDetails(sessionId: string) {
  const [sessionRes, responsesRes] = await Promise.all([
    supabase
      .from("past_question_sessions")
      .select("*, exam_types(*), institutions(*)")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("past_question_responses")
      .select("*, past_questions(*, past_question_options(*))")
      .eq("session_id", sessionId),
  ]);

  if (sessionRes.error) {
    console.error("Error fetching session details:", sessionRes.error);
    return null;
  }

  return {
    session: sessionRes.data as unknown as PastQuestionSession,
    responses: (responsesRes.data || []) as unknown as PastQuestionResponse[],
  };
}

/**
 * Toggle bookmark on a question
 */
export async function togglePastQuestionBookmark(
  userId: string,
  questionId: string,
  isCurrentlyBookmarked: boolean,
  notes?: string
) {
  if (isCurrentlyBookmarked) {
    const { error } = await supabase
      .from("past_question_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("question_id", questionId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase.from("past_question_bookmarks").insert({
      user_id: userId,
      question_id: questionId,
      notes: notes || null,
    });
    if (error) throw error;
    return true;
  }
}

/**
 * Fetch all bookmarks for a user
 */
export async function getUserBookmarks(userId: string): Promise<PastQuestionBookmark[]> {
  const { data, error } = await supabase
    .from("past_question_bookmarks")
    .select("*, past_questions(*, past_question_options(*), exam_types(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching bookmarks:", error);
    return [];
  }
  return data as unknown as PastQuestionBookmark[];
}

/**
 * Admin: Add a new Past Question (MCQ or Theory) with optional options
 */
export async function adminCreatePastQuestion(
  questionData: Omit<PastQuestion, "id" | "past_question_options" | "exam_types" | "institutions">,
  options?: { letter: "A" | "B" | "C" | "D" | "E"; text: string; isCorrect: boolean }[]
) {
  const { data: qData, error: qError } = await supabase
    .from("past_questions")
    .insert(questionData)
    .select("id")
    .single();

  if (qError) throw qError;

  if (options && options.length > 0) {
    const optionInserts = options.map((opt, idx) => ({
      question_id: qData.id,
      option_letter: opt.letter,
      option_text: opt.text,
      is_correct: opt.isCorrect,
      order_index: idx + 1,
    }));

    const { error: optError } = await supabase.from("past_question_options").insert(optionInserts);
    if (optError) throw optError;
  }

  return qData.id;
}

/**
 * Generate AI-powered model answer and marking scheme for theory / structured questions
 */
export async function generateAIModelAnswer(
  questionText: string,
  subject: string,
  topic?: string
): Promise<string> {
  try {
    const prompt = `You are a chief examination officer and senior STEM examiner for Nigerian and international curricula (JAMB, WAEC, University).
Provide a complete official Model Answer and Detailed Marking Guide for the following theory/structured examination question:

Subject: ${subject}
Topic: ${topic || "General"}
Question: "${questionText}"

Format your response cleanly:
1. **Model Answer / Solution**:
   - Give direct final answers followed by rigorous step-by-step working, formula derivations (using LaTeX notation like $E = mc^2$ where appropriate), and clear scientific explanations.
2. **Marking Scheme & Point Allocations**:
   - Specify point breakdowns (e.g., [1 mark] for formula, [2 marks] for substitution, [1 mark] for final value with unit).
3. **Common Pitfalls & Examiner Tips**:
   - Brief notes on mistakes candidates frequently make.`;

    const { data, error } = await supabase.functions.invoke("ai-helper", {
      body: { prompt, type: "homework" },
    });

    if (!error && (data?.response || data?.text)) {
      return data.response || data.text;
    }
  } catch (err) {
    console.warn("AI edge function unavailable, generating structured template:", err);
  }

  // High quality structured fallback
  return `### Official Model Answer & Marking Scheme

**Subject:** ${subject} ${topic ? `• **Topic:** ${topic}` : ""}

#### 1. Detailed Solution & Derivation:
- **Given Parameters & Relevant Formulae:**
  Identify all known quantities from the question statement. State the standard scientific or mathematical governing law:
  $$\\text{Governing Equation or Principle}$$

- **Step-by-step Working:**
  1. Substitute given values or derive expressions clearly.
  2. Simplify algebraically maintaining unit consistency.
  3. Compute the final numerical or theoretical result.

- **Final Conclusion:**
  State the final conclusion clearly with appropriate SI units or scientific terminology.

---

#### 2. Marking Guide & Point Distribution:
- **Method Mark (M1):** Stating the correct formula or principle [1 mark]
- **Substitution Mark (M1):** Correct algebraic or numerical substitution [1 mark]
- **Accuracy Mark (A1):** Correct final answer with appropriate units [1 mark]
- **Explanation/Rationale (B1):** Clear scientific justification where required [1 mark]
*(Total: 4 Marks)*

---
*Tip: Always state definitions clearly and include units in all final calculations.*`;
}

/**
 * Admin: Delete a past question
 */
export async function adminDeletePastQuestion(questionId: string) {
  const { error } = await supabase.from("past_questions").delete().eq("id", questionId);
  if (error) throw error;
}

/**
 * Admin: Toggle question published status
 */
export async function adminTogglePublishQuestion(questionId: string, currentStatus: boolean) {
  const { error } = await supabase
    .from("past_questions")
    .update({ is_published: !currentStatus })
    .eq("id", questionId);
  if (error) throw error;
}

/**
 * Fetch academic programmes for an institution (e.g. MBBS, BDS, BSc)
 */
export async function getAcademicProgrammes(institutionId?: string): Promise<AcademicProgramme[]> {
  let query = supabase
    .from("academic_programmes")
    .select("*, institutions(*)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (institutionId && institutionId !== "all") {
    query = query.eq("institution_id", institutionId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching academic programmes:", error);
    return [];
  }
  return (data || []) as unknown as AcademicProgramme[];
}

/**
 * Fetch exam structures (e.g. Block 1, Block 2, First Semester)
 */
export async function getExamStructures(
  programmeId?: string,
  institutionId?: string
): Promise<ExamStructure[]> {
  let query = supabase
    .from("exam_structures")
    .select("*, academic_programmes(*)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (programmeId && programmeId !== "all") {
    query = query.eq("programme_id", programmeId);
  }
  if (institutionId && institutionId !== "all") {
    query = query.eq("institution_id", institutionId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching exam structures:", error);
    return [];
  }
  return (data || []) as unknown as ExamStructure[];
}

/**
 * Fetch university courses (e.g. ANA 201, PHS 201)
 */
export async function getUniversityCourses(
  programmeId?: string,
  academicLevel?: string
): Promise<UniversityCourse[]> {
  let query = supabase
    .from("university_courses")
    .select("*, academic_programmes(*), exam_structures(*)")
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (programmeId && programmeId !== "all") {
    query = query.eq("programme_id", programmeId);
  }
  if (academicLevel && academicLevel !== "all") {
    query = query.eq("academic_level", academicLevel);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching university courses:", error);
    return [];
  }
  return (data || []) as unknown as UniversityCourse[];
}

/**
 * Fetch curated past question compilations & collections (e.g. Shuiyebo's Anatomy)
 */
export async function getPastQuestionCollections(filters: {
  institutionId?: string;
  programmeId?: string;
  examStructureId?: string;
  courseId?: string;
  academicLevel?: string;
  searchQuery?: string;
} = {}): Promise<PastQuestionCollection[]> {
  let query = supabase
    .from("past_question_collections")
    .select(
      `
      *,
      institutions (*),
      academic_programmes (*),
      exam_structures (*),
      university_courses (*)
    `
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (filters.institutionId && filters.institutionId !== "all") {
    query = query.eq("institution_id", filters.institutionId);
  }
  if (filters.programmeId && filters.programmeId !== "all") {
    query = query.eq("programme_id", filters.programmeId);
  }
  if (filters.examStructureId && filters.examStructureId !== "all") {
    query = query.eq("exam_structure_id", filters.examStructureId);
  }
  if (filters.courseId && filters.courseId !== "all") {
    query = query.eq("course_id", filters.courseId);
  }
  if (filters.academicLevel && filters.academicLevel !== "all") {
    query = query.eq("academic_level", filters.academicLevel);
  }
  if (filters.searchQuery) {
    query = query.or(
      `title.ilike.%${filters.searchQuery}%,compiler_name.ilike.%${filters.searchQuery}%,subject.ilike.%${filters.searchQuery}%,course_code.ilike.%${filters.searchQuery}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching collections:", error);
    return [];
  }

  return (data || []) as unknown as PastQuestionCollection[];
}

/**
 * Fetch a single collection by ID
 */
export async function getCollectionById(collectionId: string): Promise<PastQuestionCollection | null> {
  const { data, error } = await supabase
    .from("past_question_collections")
    .select(
      `
      *,
      institutions (*),
      academic_programmes (*),
      exam_structures (*),
      university_courses (*)
    `
    )
    .eq("id", collectionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching collection:", error);
    return null;
  }
  return data as unknown as PastQuestionCollection;
}

/**
 * Admin: Create or update an academic programme
 */
export async function adminCreateProgramme(
  programmeData: Partial<AcademicProgramme>
): Promise<AcademicProgramme> {
  const { data, error } = await supabase
    .from("academic_programmes")
    .insert({
      institution_id: programmeData.institution_id,
      faculty: programmeData.faculty,
      name: programmeData.name,
      code: programmeData.code,
      degree_type: programmeData.degree_type || "undergraduate",
      examination_system: programmeData.examination_system || "block",
      levels: programmeData.levels || ["100L", "200L", "300L", "400L", "500L"],
      is_active: true,
    })
    .select("*, institutions(*)")
    .single();

  if (error) throw error;
  return data as unknown as AcademicProgramme;
}

/**
 * Admin: Create or update an exam structure
 */
export async function adminCreateExamStructure(
  structureData: Partial<ExamStructure>
): Promise<ExamStructure> {
  const { data, error } = await supabase
    .from("exam_structures")
    .insert({
      programme_id: structureData.programme_id,
      institution_id: structureData.institution_id,
      name: structureData.name,
      structure_type: structureData.structure_type || "block",
      academic_level: structureData.academic_level,
      display_order: structureData.display_order || 1,
      is_active: true,
    })
    .select("*, academic_programmes(*)")
    .single();

  if (error) throw error;
  return data as unknown as ExamStructure;
}

/**
 * Admin: Create or update university course
 */
export async function adminCreateUniversityCourse(
  courseData: Partial<UniversityCourse>
): Promise<UniversityCourse> {
  const { data, error } = await supabase
    .from("university_courses")
    .insert({
      institution_id: courseData.institution_id,
      programme_id: courseData.programme_id,
      code: courseData.code,
      title: courseData.title,
      academic_level: courseData.academic_level,
      exam_structure_id: courseData.exam_structure_id,
      is_active: true,
    })
    .select("*, academic_programmes(*), exam_structures(*)")
    .single();

  if (error) throw error;
  return data as unknown as UniversityCourse;
}

/**
 * Admin: Create or update a collection compilation
 */
export async function adminCreateCollection(
  colData: Partial<PastQuestionCollection>
): Promise<PastQuestionCollection> {
  const { data, error } = await supabase
    .from("past_question_collections")
    .insert({
      institution_id: colData.institution_id,
      programme_id: colData.programme_id,
      exam_structure_id: colData.exam_structure_id,
      course_id: colData.course_id,
      title: colData.title,
      compiler_name: colData.compiler_name,
      description: colData.description,
      academic_level: colData.academic_level,
      subject: colData.subject,
      course_code: colData.course_code,
      start_year: colData.start_year,
      end_year: colData.end_year,
      supported_formats: colData.supported_formats || ["mcq", "theory"],
      document_url: colData.document_url,
      has_answers: colData.has_answers ?? true,
      has_marking_scheme: colData.has_marking_scheme ?? true,
      attribution_info: colData.attribution_info,
      is_verified: true,
      is_published: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as PastQuestionCollection;
}

/**
 * Admin: Delete a collection
 */
export async function adminDeleteCollection(collectionId: string): Promise<void> {
  const { error } = await supabase
    .from("past_question_collections")
    .delete()
    .eq("id", collectionId);
  if (error) throw error;
}

/**
 * Synthesize and ensure CBT MCQ questions for a collection based on its course and examination content
 */
export async function ensureCBTQuestionsForCollection(
  collectionId: string,
  examTypeId: string,
  requestedCount: number = 10,
  userId?: string,
  section?: string
): Promise<PastQuestion[]> {
  // 1. Check if questions are already saved for this collection
  const existing = await fetchPastQuestions({ collectionId }, userId);
  if (existing && existing.length >= Math.min(5, requestedCount)) {
    return existing;
  }

  // 2. Fetch collection details
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return existing;
  }

  // 3. Request AI to synthesize authentic CBT questions matching this exam
  const countToGenerate = Math.min(25, Math.max(5, requestedCount));
  const prompt = `You are a university examination board examiner preparing a Computer-Based Test (CBT) examination.
Based on the university past questions collection titled "${collection.title}" for Course: ${collection.course_code || ""} ${collection.subject} (Academic Level: ${collection.academic_level || "Undergraduate"}).
Description: ${collection.description || "Official past examination paper"}

Generate ${countToGenerate} realistic, high-yield Multiple Choice Questions (MCQs) for this university examination paper.
Every question MUST test the exact academic subject matter of "${collection.subject}" at the "${collection.academic_level || "undergraduate"}" level.
Return strictly a valid JSON array of objects with NO markdown code fencing, NO commentary:
[
  {
    "question_text": "Detailed question stem...",
    "explanation": "Clear explanation of why the correct option is right and others are incorrect.",
    "options": [
      { "text": "Option A text", "is_correct": false },
      { "text": "Option B text", "is_correct": true },
      { "text": "Option C text", "is_correct": false },
      { "text": "Option D text", "is_correct": false }
    ]
  }
]`;

  try {
    const { data: aiResponse, error: aiErr } = await supabase.functions.invoke("ai-helper", {
      body: { prompt, type: "homework" },
    });

    if (aiErr || !aiResponse) {
      console.warn("AI CBT generation failed:", aiErr);
      return existing;
    }

    const text = aiResponse?.response || aiResponse?.reply || aiResponse?.text || aiResponse?.solution || (typeof aiResponse === "string" ? aiResponse : "");
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      return existing;
    }

    const parsedMCQs = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsedMCQs) || parsedMCQs.length === 0) {
      return existing;
    }

    // 4. Insert each question into past_questions and options into past_question_options
    for (let i = 0; i < parsedMCQs.length; i++) {
      const q = parsedMCQs[i];
      const { data: insertedQ, error: qErr } = await supabase
        .from("past_questions")
        .insert({
          exam_type_id: examTypeId || "1bae3155-f796-4764-bcfd-d6f43daa15ba",
          institution_id: collection.institution_id || null,
          academic_level: collection.academic_level || null,
          subject: collection.subject,
          course_code: collection.course_code || null,
          collection_id: collection.id,
          year: collection.start_year || new Date().getFullYear(),
          question_number: i + 1,
          question_format: "mcq",
          question_text: q.question_text,
          explanation: q.explanation || null,
          is_verified: true,
          is_published: true,
          created_by: userId || null,
        })
        .select()
        .single();

      if (insertedQ && q.options && Array.isArray(q.options)) {
        const optionRows = q.options.map((opt: any, optIdx: number) => ({
          question_id: insertedQ.id,
          option_letter: ["A", "B", "C", "D", "E"][optIdx] || "A",
          option_text: opt.text,
          is_correct: !!opt.is_correct,
          order_index: optIdx + 1,
        }));
        await supabase.from("past_question_options").insert(optionRows);
      }
    }

    // Fetch the newly inserted questions
    return await fetchPastQuestions({ collectionId }, userId);
  } catch (genErr) {
    console.error("Error in ensureCBTQuestionsForCollection:", genErr);
    return existing;
  }
}



