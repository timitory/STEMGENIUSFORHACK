import { supabase } from "@/integrations/supabase/client";
import {
  VirtualClass,
  ClassRegistration,
  ClassRecording,
  ClassQAItem,
  ClassHandRaise,
  CreateClassData,
} from "@/types/virtualClasses";

/**
 * Fetch upcoming and live virtual classes
 */
export async function fetchVirtualClasses(userId?: string): Promise<VirtualClass[]> {
  const { data, error } = await supabase
    .from("virtual_classes")
    .select(
      `
      *,
      host:host_id (name),
      exam_types (*),
      institutions (*),
      class_recordings (*)
    `
    )
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("Error fetching virtual classes:", error);
    return [];
  }

  const classes = (data || []) as unknown as VirtualClass[];

  // If user is logged in, attach registration status
  if (userId && classes.length > 0) {
    const classIds = classes.map((c) => c.id);
    const { data: regs } = await supabase
      .from("class_registrations")
      .select("class_id")
      .eq("user_id", userId)
      .in("class_id", classIds);

    const regSet = new Set((regs || []).map((r: any) => r.class_id));
    return classes.map((c) => ({
      ...c,
      is_registered: regSet.has(c.id),
    }));
  }

  return classes;
}

/**
 * Fetch a single class by its secure room ID
 */
export async function fetchClassByRoomId(
  roomId: string,
  userId?: string
): Promise<VirtualClass | null> {
  const { data, error } = await supabase
    .from("virtual_classes")
    .select(
      `
      *,
      host:host_id (name),
      exam_types (*),
      institutions (*),
      class_recordings (*)
    `
    )
    .eq("room_id", roomId)
    .single();

  if (error) {
    console.error("Error fetching class by room:", error);
    return null;
  }

  const cls = data as unknown as VirtualClass;

  if (userId) {
    const { data: reg } = await supabase
      .from("class_registrations")
      .select("*")
      .eq("class_id", cls.id)
      .eq("user_id", userId)
      .maybeSingle();

    cls.is_registered = !!reg;
  }

  return cls;
}

/**
 * Register user for a scheduled class / webinar
 */
export async function registerForClass(classId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from("class_registrations").upsert(
    {
      class_id: classId,
      user_id: userId,
      registered_at: new Date().toISOString(),
      attendance_status: "registered",
    },
    { onConflict: "class_id,user_id" }
  );

  if (error) {
    console.error("Error registering for class:", error);
    return false;
  }
  return true;
}

/**
 * Create a new virtual class / webinar
 */
export async function createVirtualClass(
  hostId: string,
  data: CreateClassData
): Promise<VirtualClass | null> {
  // Generate friendly URL slug
  const cleanTitle = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const roomId = `${cleanTitle}-${Math.random().toString(36).substring(2, 7)}`;

  let newClass: any = null;
  const insertPayload = {
    room_id: roomId,
    host_id: hostId,
    title: data.title,
    description: data.description || null,
    subject: data.subject,
    topic: data.topic || null,
    exam_type_id: data.examTypeId || null,
    institution_id: data.institutionId || null,
    scheduled_start: data.scheduledStart,
    duration_minutes: data.durationMinutes,
    max_capacity: data.maxCapacity,
    access_type: data.accessType,
    passcode: data.passcode?.trim() || null,
    meeting_format: data.meetingFormat,
    is_recording_enabled: data.isRecordingEnabled,
    host_announcements: data.hostAnnouncements || null,
    pre_join_question: data.preJoinQuestion?.trim() || null,
    status: "scheduled",
  };

  const { data: inserted, error } = await supabase
    .from("virtual_classes")
    .insert(insertPayload)
    .select("*, host:host_id(name)")
    .maybeSingle();

  if (error) {
    console.warn("Retrying createVirtualClass with plain select fallback:", error);
    const { data: fallbackInserted, error: fallbackError } = await supabase
      .from("virtual_classes")
      .insert(insertPayload)
      .select("*")
      .single();

    if (fallbackError) {
      console.error("Error creating virtual class:", fallbackError);
      throw fallbackError;
    }
    newClass = fallbackInserted;
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", hostId)
      .maybeSingle();
    if (newClass && hostProfile) {
      newClass.host = hostProfile;
    }
  } else {
    newClass = inserted;
  }

  return newClass as unknown as VirtualClass;
}

/**
 * Track user attendance when entering room
 */
export async function trackAttendanceJoin(classId: string, userId: string) {
  await supabase.from("class_registrations").upsert(
    {
      class_id: classId,
      user_id: userId,
      attendance_status: "attended",
      joined_at: new Date().toISOString(),
    },
    { onConflict: "class_id,user_id" }
  );
}

/**
 * Fetch all completed recordings available for replay
 */
export async function fetchCompletedRecordings(): Promise<
  (ClassRecording & { virtual_classes?: VirtualClass })[]
> {
  const { data, error } = await supabase
    .from("class_recordings")
    .select(
      `
      *,
      virtual_classes (*, host:host_id(name), exam_types(*))
    `
    )
    .eq("status", "ready")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recordings:", error);
    return [];
  }
  return (data || []) as any;
}

/**
 * Fetch Q&A for a live class
 */
export async function fetchClassQA(classId: string): Promise<ClassQAItem[]> {
  const { data, error } = await supabase
    .from("class_qa_items")
    .select("*, user:user_id(name)")
    .eq("class_id", classId)
    .order("upvotes_count", { ascending: false });

  if (error) {
    console.error("Error fetching Q&A:", error);
    return [];
  }
  return (data || []) as unknown as ClassQAItem[];
}

/**
 * Submit a question to the live Q&A panel
 */
export async function submitClassQuestion(
  classId: string,
  userId: string,
  questionText: string
): Promise<ClassQAItem | null> {
  const { data, error } = await supabase
    .from("class_qa_items")
    .insert({
      class_id: classId,
      user_id: userId,
      question_text: questionText,
    })
    .select("*, user:user_id(name)")
    .single();

  if (error) {
    console.error("Error submitting question:", error);
    throw error;
  }
  return data as unknown as ClassQAItem;
}

/**
 * Toggle raise hand in a webinar
 */
export async function toggleRaiseHand(classId: string, userId: string, currentlyRaised: boolean) {
  if (currentlyRaised) {
    await supabase
      .from("class_hand_raises")
      .delete()
      .eq("class_id", classId)
      .eq("user_id", userId);
    return false;
  } else {
    await supabase.from("class_hand_raises").upsert(
      {
        class_id: classId,
        user_id: userId,
        is_approved: false,
      },
      { onConflict: "class_id,user_id" }
    );
    return true;
  }
}

/**
 * Fetch all hand raises for the host queue
 */
export async function fetchHandRaises(classId: string): Promise<ClassHandRaise[]> {
  const { data, error } = await supabase
    .from("class_hand_raises")
    .select("*, user:user_id(name)")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching hand raises:", error);
    return [];
  }
  return (data || []) as unknown as ClassHandRaise[];
}

/**
 * Approve or revoke permission for a raised hand to speak
 */
export async function approveHandRaise(handRaiseId: string, isApproved: boolean) {
  const { error } = await supabase
    .from("class_hand_raises")
    .update({ is_approved: isApproved })
    .eq("id", handRaiseId);

  if (error) console.error("Error updating hand raise:", error);
}

/**
 * Dismiss a raised hand from the queue
 */
export async function removeHandRaise(handRaiseId: string) {
  await supabase.from("class_hand_raises").delete().eq("id", handRaiseId);
}

/**
 * Upvote a Q&A question
 */
export async function upvoteClassQA(questionId: string) {
  // Fetch current upvotes
  const { data } = await supabase
    .from("class_qa_items")
    .select("upvotes_count")
    .eq("id", questionId)
    .single();

  const currentCount = data?.upvotes_count || 0;
  await supabase
    .from("class_qa_items")
    .update({ upvotes_count: currentCount + 1 })
    .eq("id", questionId);
}

/**
 * Answer a Q&A question
 */
export async function answerClassQA(questionId: string, answerText: string, answeredBy: string) {
  const { error } = await supabase
    .from("class_qa_items")
    .update({
      is_answered: true,
      answer_text: answerText,
      answered_by: answeredBy,
    })
    .eq("id", questionId);

  if (error) console.error("Error answering Q&A:", error);
}

/**
 * Update class status (live, ended, etc.)
 */
export async function updateClassStatus(classId: string, status: 'scheduled' | 'live' | 'ended') {
  const updateData: any = { status };
  if (status === 'live') {
    updateData.actual_started_at = new Date().toISOString();
  } else if (status === 'ended') {
    updateData.actual_ended_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("virtual_classes")
    .update(updateData)
    .eq("id", classId);

  if (error) console.error("Error updating class status:", error);
}

/**
 * Complete a class session and register recording in ready status
 */
export async function endClassAndGenerateRecording(
  classId: string,
  title: string,
  durationSeconds: number = 0,
  realVideoUrl?: string,
  realFileSizeBytes?: number
) {
  await updateClassStatus(classId, 'ended');

  // If no recording was captured, mark ended without fabricating dummy media
  if (!realVideoUrl) {
    return null;
  }

  // Insert real ready recording
  const { data, error } = await supabase
    .from("class_recordings")
    .insert({
      class_id: classId,
      recording_title: `${title} - Live Session Recording`,
      video_url: realVideoUrl,
      thumbnail_url: null,
      duration_seconds: durationSeconds,
      file_size_bytes: realFileSizeBytes || 0,
      status: "ready",
      access_permission: "public",
      view_count: 1,
      ready_at: new Date().toISOString()
    })
    .select()
    .maybeSingle();

  if (error) console.error("Error generating recording:", error);
  return data;
}


/**
 * Submit attendee answer to host pre-join question
 */
export async function submitPreJoinAnswer(classId: string, userId: string, answer: string): Promise<boolean> {
  const { error } = await supabase.from("class_registrations").upsert(
    {
      class_id: classId,
      user_id: userId,
      pre_join_answer: answer,
      registered_at: new Date().toISOString(),
      attendance_status: "registered",
    },
    { onConflict: "class_id,user_id" }
  );
  if (error) {
    console.error("Error saving pre-join answer:", error);
    return false;
  }
  return true;
}
