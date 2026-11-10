import { ExamType, Institution } from "./pastQuestions";

export interface VirtualClass {
  id: string;
  room_id: string;
  host_id: string;
  co_host_ids: string[];
  title: string;
  description: string | null;
  subject: string;
  topic: string | null;
  exam_type_id: string | null;
  institution_id: string | null;
  scheduled_start: string;
  duration_minutes: number;
  max_capacity: number;
  access_type: 'public' | 'registered_only' | 'private';
  passcode?: string | null;
  is_waiting_room_enabled: boolean;
  meeting_format: 'webinar' | 'interactive_meeting';
  is_recording_enabled: boolean;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  actual_started_at: string | null;
  actual_ended_at: string | null;
  peak_participants: number;
  banner_image_url: string | null;
  presentation_slides_url: string | null;
  host_announcements: string | null;
  pre_join_question?: string | null;
  // Zoom Integration Fields
  zoom_meeting_id?: string | null;
  zoom_numeric_id?: number | null;
  zoom_uuid?: string | null;
  zoom_join_url?: string | null;
  zoom_start_url?: string | null;
  zoom_passcode?: string | null;
  zoom_host_id?: string | null;
  zoom_recording_status?: 'not_started' | 'recording' | 'processing' | 'available' | 'failed' | null;
  zoom_metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Joins
  host?: {
    name: string;
  };
  exam_types?: ExamType;
  institutions?: Institution;
  class_recordings?: ClassRecording[];
  registrations_count?: number;
  is_registered?: boolean;
}

export interface ClassRegistration {
  id: string;
  class_id: string;
  user_id: string;
  registered_at: string;
  attendance_status: 'registered' | 'attended' | 'absent';
  joined_at: string | null;
  left_at: string | null;
  minutes_attended: number;
  pre_join_answer?: string | null;
}

export interface ClassRecording {
  id: string;
  class_id: string;
  recording_title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  file_size_bytes: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  access_permission: 'public' | 'registered_attendees' | 'host_only';
  zoom_recording_id?: string | null;
  zoom_play_url?: string | null;
  zoom_download_url?: string | null;
  zoom_share_url?: string | null;
  zoom_recording_files?: any[];
  view_count: number;
  created_at: string;
  ready_at: string | null;
}

export interface ClassQAItem {
  id: string;
  class_id: string;
  user_id: string;
  question_text: string;
  upvotes_count: number;
  is_answered: boolean;
  answer_text: string | null;
  answered_by: string | null;
  created_at: string;
  user?: {
    name: string;
  };
}

export interface ClassHandRaise {
  id: string;
  class_id: string;
  user_id: string;
  is_approved: boolean;
  created_at: string;
  user?: {
    name: string;
  };
}

export interface CreateClassData {
  title: string;
  description?: string;
  subject: string;
  topic?: string;
  examTypeId?: string;
  institutionId?: string;
  scheduledStart: string;
  durationMinutes: number;
  maxCapacity: number;
  accessType: 'public' | 'registered_only';
  passcode?: string;
  meetingFormat: 'webinar' | 'interactive_meeting';
  isRecordingEnabled: boolean;
  hostAnnouncements?: string;
  preJoinQuestion?: string;
}

