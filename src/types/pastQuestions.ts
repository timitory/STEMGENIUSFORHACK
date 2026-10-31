export interface ExamType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  has_institutions: boolean;
  has_levels: boolean;
  default_duration_minutes: number;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Institution {
  id: string;
  name: string;
  short_code: string;
  type: string;
  state: string | null;
  logo_url: string | null;
  is_active: boolean;
}

export interface ExamDepartment {
  id: string;
  institution_id: string;
  faculty: string | null;
  name: string;
  code: string | null;
}

export interface AcademicProgramme {
  id: string;
  institution_id: string;
  faculty: string;
  name: string;
  code: string | null;
  degree_type: 'undergraduate' | 'postgraduate' | 'professional';
  examination_system: 'block' | 'semester' | 'trimester' | 'annual';
  levels: string[];
  is_active: boolean;
  created_at?: string;
  // Joins
  institutions?: Institution;
}

export interface ExamStructure {
  id: string;
  programme_id: string | null;
  institution_id: string | null;
  name: string;
  structure_type: 'block' | 'semester' | 'trimester' | 'annual' | 'professional' | 'in_course';
  academic_level: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  // Joins
  academic_programmes?: AcademicProgramme;
}

export interface UniversityCourse {
  id: string;
  institution_id: string;
  programme_id: string | null;
  code: string;
  title: string;
  academic_level: string;
  exam_structure_id: string | null;
  is_active: boolean;
  created_at?: string;
  // Joins
  institutions?: Institution;
  academic_programmes?: AcademicProgramme;
  exam_structures?: ExamStructure;
}

export interface PastQuestionCollection {
  id: string;
  institution_id: string;
  programme_id: string | null;
  exam_structure_id: string | null;
  course_id: string | null;
  title: string;
  compiler_name: string;
  description: string | null;
  academic_level: string | null;
  subject: string;
  course_code: string | null;
  start_year: number | null;
  end_year: number | null;
  supported_formats: string[];
  document_url: string | null;
  has_answers: boolean;
  has_marking_scheme: boolean;
  attribution_info: string | null;
  is_verified: boolean;
  is_published: boolean;
  view_count: number;
  download_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  institutions?: Institution;
  academic_programmes?: AcademicProgramme;
  exam_structures?: ExamStructure;
  university_courses?: UniversityCourse;
  question_count?: number;
}

export interface PastQuestionOption {
  id: string;
  question_id: string;
  option_letter: 'A' | 'B' | 'C' | 'D' | 'E';
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface PastQuestion {
  id: string;
  exam_type_id: string;
  institution_id: string | null;
  department_id: string | null;
  programme_id?: string | null;
  exam_structure_id?: string | null;
  course_id?: string | null;
  collection_id?: string | null;
  course_code?: string | null;
  source_attribution?: string | null;
  academic_level: string | null;
  subject: string;
  topic: string | null;
  subtopic: string | null;
  year: number;
  paper_type: string;
  question_number: number | null;
  question_format: 'mcq' | 'theory' | 'short_answer';
  question_text: string;
  diagram_url: string | null;
  explanation: string | null;
  model_answer: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  is_verified: boolean;
  is_published: boolean;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  // Joins
  exam_types?: ExamType;
  institutions?: Institution;
  past_question_options?: PastQuestionOption[];
  is_bookmarked?: boolean;
}

export interface PastQuestionSession {
  id: string;
  user_id: string;
  session_mode: 'practice' | 'timed_exam' | 'topic_drill';
  exam_type_id: string | null;
  institution_id: string | null;
  subject: string;
  topic: string | null;
  year: number | null;
  total_questions: number;
  time_limit_seconds: number;
  time_spent_seconds: number;
  score: number;
  total_points: number;
  correct_answers: number;
  incorrect_answers: number;
  unanswered_questions: number;
  accuracy_percentage: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  exam_types?: ExamType;
  past_question_responses?: PastQuestionResponse[];
}

export interface PastQuestionResponse {
  id: string;
  session_id: string;
  question_id: string;
  selected_option_id: string | null;
  theory_response: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number;
  created_at: string;
  past_questions?: PastQuestion;
}

export interface PastQuestionBookmark {
  id: string;
  user_id: string;
  question_id: string;
  notes: string | null;
  created_at: string;
  past_questions?: PastQuestion;
}

export interface PastQuestionFilters {
  examTypeId?: string;
  institutionId?: string;
  departmentId?: string;
  programmeId?: string;
  examStructureId?: string;
  courseId?: string;
  collectionId?: string;
  academicLevel?: string;
  subject?: string;
  topic?: string;
  year?: number;
  questionFormat?: string;
  searchQuery?: string;
  mode?: 'practice' | 'timed_exam' | 'topic_drill';
}

