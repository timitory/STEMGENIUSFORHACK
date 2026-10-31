export interface TutorQualification {
  title: string;
  institution: string;
  year: number;
  is_verified: boolean;
}

export interface TutorProfile {
  id: string;
  user_id: string;
  headline: string;
  bio: string;
  teaching_philosophy: string | null;
  qualifications: TutorQualification[];
  experience_years: number;
  subjects: string[];
  topics: string[];
  exam_types: string[];
  student_levels: string[];
  languages: string[];
  hourly_rate: number;
  offers_free_sessions: boolean;
  free_session_duration_minutes: number;
  paid_session_duration_minutes: number;
  teaching_formats: ('one_to_one' | 'group')[];
  max_group_size: number;
  group_session_rate: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_notes: string | null;
  id_document_url: string | null;
  cv_url: string | null;
  is_active: boolean;
  rating_average: number;
  total_reviews: number;
  total_sessions_completed: number;
  created_at: string;
  updated_at: string;
  // Joins
  profiles?: {
    name: string;
    avatar_url?: string;
  };
  tutor_availability?: TutorAvailability[];
}

export interface TutorAvailability {
  id: string;
  tutor_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ...
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  is_active: boolean;
}

export interface TutorBooking {
  id: string;
  booking_reference: string;
  tutor_id: string;
  student_id: string;
  subject: string;
  topic: string | null;
  session_format: 'one_to_one' | 'group';
  is_free: boolean;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  amount_paid: number;
  platform_fee: number;
  tutor_earnings: number;
  payment_status: 'free' | 'pending' | 'paid' | 'refunded' | 'failed';
  payment_reference: string | null;
  status: 'pending_payment' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  room_id: string;
  student_notes: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  tutor_profiles?: TutorProfile;
  student?: {
    name: string;
  };
}

export interface TutorWallet {
  id: string;
  tutor_id: string;
  available_balance: number;
  pending_balance: number;
  total_withdrawn: number;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  recipient_code: string | null;
  updated_at: string;
}

export interface TutorReview {
  id: string;
  booking_id: string;
  tutor_id: string;
  student_id: string;
  rating: number;
  review_text: string | null;
  is_public: boolean;
  created_at: string;
  student?: {
    name: string;
  };
}

export interface TutorPayout {
  id: string;
  tutor_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transfer_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface TutorFilters {
  subject?: string;
  examType?: string;
  isFree?: boolean;
  maxPrice?: number;
  teachingFormat?: 'one_to_one' | 'group';
  studentLevel?: string;
  searchQuery?: string;
}

export interface TutorApplicationData {
  headline: string;
  bio: string;
  teaching_philosophy?: string;
  qualifications: TutorQualification[];
  experience_years: number;
  subjects: string[];
  topics?: string[];
  exam_types?: string[];
  student_levels?: string[];
  languages?: string[];
  hourly_rate: number;
  offers_free_sessions: boolean;
  teaching_formats: ('one_to_one' | 'group')[];
  id_document_url?: string;
  cv_url?: string;
}

