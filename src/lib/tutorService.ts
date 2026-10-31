import { supabase } from "@/integrations/supabase/client";
import {
  TutorProfile,
  TutorAvailability,
  TutorBooking,
  TutorWallet,
  TutorReview,
  TutorFilters,
  TutorApplicationData,
} from "@/types/tutorMarketplace";

/**
 * Fetch verified tutors for the marketplace directory with filtering
 */
export async function fetchTutors(filters: TutorFilters = {}): Promise<TutorProfile[]> {
  let query = supabase
    .from("tutor_profiles")
    .select(
      `
      *,
      profiles:user_id (name),
      tutor_availability (*)
    `
    )
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("rating_average", { ascending: false });

  if (filters.subject) {
    query = query.contains("subjects", [filters.subject]);
  }
  if (filters.examType) {
    query = query.contains("exam_types", [filters.examType]);
  }
  if (filters.isFree !== undefined && filters.isFree) {
    query = query.eq("offers_free_sessions", true);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    query = query.lte("hourly_rate", filters.maxPrice);
  }
  if (filters.teachingFormat) {
    query = query.contains("teaching_formats", [filters.teachingFormat]);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching tutors:", error);
    return [];
  }

  let tutors = (data || []) as unknown as TutorProfile[];

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase();
    tutors = tutors.filter(
      (t) =>
        t.headline.toLowerCase().includes(q) ||
        t.bio.toLowerCase().includes(q) ||
        t.profiles?.name?.toLowerCase().includes(q) ||
        t.subjects.some((s) => s.toLowerCase().includes(q))
    );
  }

  return tutors;
}

/**
 * Fetch a single tutor's complete profile with availability & reviews
 */
export async function fetchTutorById(tutorId: string): Promise<TutorProfile | null> {
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(
      `
      *,
      profiles:user_id (name),
      tutor_availability (*)
    `
    )
    .eq("id", tutorId)
    .single();

  if (error) {
    console.error("Error fetching tutor profile:", error);
    return null;
  }
  return data as unknown as TutorProfile;
}

/**
 * Check if the currently logged-in user already has a tutor profile
 */
export async function checkUserTutorStatus(userId: string): Promise<TutorProfile | null> {
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking tutor status:", error);
    return null;
  }
  return data as unknown as TutorProfile;
}

/**
 * Submit or update tutor application
 */
export async function submitTutorApplication(
  userId: string,
  data: TutorApplicationData
): Promise<TutorProfile | null> {
  const payload = {
    user_id: userId,
    headline: data.headline,
    bio: data.bio,
    teaching_philosophy: data.teaching_philosophy || null,
    qualifications: data.qualifications,
    experience_years: data.experience_years,
    subjects: data.subjects,
    topics: data.topics || [],
    exam_types: data.exam_types || [],
    student_levels: data.student_levels || [],
    languages: data.languages || ["English"],
    hourly_rate: data.hourly_rate,
    offers_free_sessions: data.offers_free_sessions,
    teaching_formats: data.teaching_formats,
    id_document_url: data.id_document_url || null,
    cv_url: data.cv_url || null,
    verification_status: "pending",
  };

  const { data: profile, error } = await supabase
    .from("tutor_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("Error submitting tutor application:", error);
    throw error;
  }

  return profile as unknown as TutorProfile;
}

/**
 * Create a new lesson booking (free or paid)
 */
export async function createLessonBooking(params: {
  tutorId: string;
  studentId: string;
  subject: string;
  topic?: string;
  sessionFormat: "one_to_one" | "group";
  isFree: boolean;
  scheduledStart: string;
  durationMinutes: number;
  hourlyRate: number;
  studentNotes?: string;
}): Promise<TutorBooking | null> {
  // Generate unique booking reference and room ID
  const refCode = "BK-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomId = "stem-tutoring-" + Math.random().toString(36).substring(2, 12);

  const startDate = new Date(params.scheduledStart);
  const endDate = new Date(startDate.getTime() + params.durationMinutes * 60 * 1000);

  const amount = params.isFree ? 0 : Math.round((params.hourlyRate * params.durationMinutes) / 60);
  const platformFee = params.isFree ? 0 : Math.round(amount * 0.15); // 15% platform commission
  const tutorEarnings = amount - platformFee;

  const { data, error } = await supabase
    .from("tutor_bookings")
    .insert({
      booking_reference: refCode,
      tutor_id: params.tutorId,
      student_id: params.studentId,
      subject: params.subject,
      topic: params.topic || null,
      session_format: params.sessionFormat,
      is_free: params.isFree,
      scheduled_start: startDate.toISOString(),
      scheduled_end: endDate.toISOString(),
      duration_minutes: params.durationMinutes,
      amount_paid: amount,
      platform_fee: platformFee,
      tutor_earnings: tutorEarnings,
      payment_status: params.isFree ? "free" : "pending",
      status: params.isFree ? "scheduled" : "pending_payment",
      room_id: roomId,
      student_notes: params.studentNotes || null,
    })
    .select("*, tutor_profiles(*)")
    .single();

  if (error) {
    console.error("Error creating booking:", error);
    throw error;
  }

  return data as unknown as TutorBooking;
}

/**
 * Confirm a paid booking with Paystack payment reference
 */
export async function verifyBookingPayment(
  bookingId: string,
  paymentReference: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tutor_bookings")
    .update({
      payment_status: "paid",
      status: "scheduled",
      payment_reference: paymentReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (error) {
    console.error("Error confirming booking payment:", error);
    return false;
  }
  return true;
}

/**
 * Fetch bookings for a student or tutor
 */
export async function fetchUserBookings(
  userId: string,
  role: "student" | "tutor"
): Promise<TutorBooking[]> {
  let query = supabase
    .from("tutor_bookings")
    .select(
      `
      *,
      tutor_profiles (*, profiles:user_id(name)),
      student:student_id (name)
    `
    )
    .order("scheduled_start", { ascending: false });

  if (role === "student") {
    query = query.eq("student_id", userId);
  } else {
    // Look up tutor profile id for this user
    const { data: tutor } = await supabase
      .from("tutor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tutor) return [];
    query = query.eq("tutor_id", tutor.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }
  return (data || []) as unknown as TutorBooking[];
}

/**
 * Fetch public reviews for a tutor
 */
export async function fetchTutorReviews(tutorId: string): Promise<TutorReview[]> {
  const { data, error } = await supabase
    .from("tutor_reviews")
    .select("*, student:student_id(name)")
    .eq("tutor_id", tutorId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
  return (data || []) as unknown as TutorReview[];
}

/**
 * Submit student review for a completed lesson
 */
export async function submitTutorReview(params: {
  bookingId: string;
  tutorId: string;
  studentId: string;
  rating: number;
  reviewText?: string;
}): Promise<boolean> {
  const { error } = await supabase.from("tutor_reviews").insert({
    booking_id: params.bookingId,
    tutor_id: params.tutorId,
    student_id: params.studentId,
    rating: params.rating,
    review_text: params.reviewText || null,
  });

  if (error) {
    console.error("Error submitting review:", error);
    return false;
  }

  // Recalculate average rating on tutor_profiles
  const { data: allReviews } = await supabase
    .from("tutor_reviews")
    .select("rating")
    .eq("tutor_id", params.tutorId);

  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((a, b) => a + b.rating, 0) / allReviews.length;
    await supabase
      .from("tutor_profiles")
      .update({
        rating_average: Math.round(avg * 10) / 10,
        total_reviews: allReviews.length,
      })
      .eq("id", params.tutorId);
  }

  return true;
}

/**
 * Fetch tutor earnings wallet
 */
export async function fetchTutorWallet(tutorId: string): Promise<TutorWallet | null> {
  const { data, error } = await supabase
    .from("tutor_wallets")
    .select("*")
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching wallet:", error);
    return null;
  }
  return data as unknown as TutorWallet;
}

/**
 * Update bank account payout information for tutor
 */
export async function updateTutorBankDetails(
  tutorId: string,
  details: { bankName: string; accountNumber: string; accountName: string }
) {
  const { error } = await supabase
    .from("tutor_wallets")
    .upsert(
      {
        tutor_id: tutorId,
        bank_name: details.bankName,
        account_number: details.accountNumber,
        account_name: details.accountName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tutor_id" }
    );

  if (error) throw error;
}

/**
 * Admin: Fetch tutor applications awaiting approval or verified
 */
export async function adminFetchTutorApplications() {
  const { data: tutors, error } = await supabase
    .from("tutor_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tutor applications:", error);
    return [];
  }

  if (!tutors || tutors.length === 0) return [];

  // Fetch user profiles for display
  const userIds = tutors.map((t) => t.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return tutors.map((t: any) => ({
    ...t,
    profiles: profileMap.get(t.user_id) || { name: "Applicant" },
  }));
}

/**
 * Admin: Adjust tutor profile details before or after approval
 */
export async function adminAdjustTutorProfile(
  tutorProfileId: string,
  adjustments: {
    hourly_rate?: number;
    offers_free_sessions?: boolean;
    subjects?: string[];
    headline?: string;
    bio?: string;
    verification_notes?: string;
  }
) {
  const { error } = await supabase
    .from("tutor_profiles")
    .update({
      ...adjustments,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tutorProfileId);

  if (error) {
    console.error("Error adjusting tutor profile:", error);
    throw error;
  }
}

/**
 * Admin: Approve or Reject a tutor application
 */
export async function adminUpdateTutorStatus(
  tutorProfileId: string,
  userId: string,
  status: "verified" | "rejected",
  notes?: string
) {
  const { error: profileError } = await supabase
    .from("tutor_profiles")
    .update({
      verification_status: status,
      verification_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tutorProfileId);

  if (profileError) throw profileError;

  if (status === "verified") {
    // Add 'tutor' role in user_roles
    await supabase.from("user_roles").upsert(
      {
        user_id: userId,
        role: "tutor" as any,
      },
      { onConflict: "user_id,role" }
    );

    // Initialize wallet if not present
    await supabase.from("tutor_wallets").upsert(
      {
        tutor_id: tutorProfileId,
        available_balance: 0,
        pending_balance: 0,
      },
      { onConflict: "tutor_id" }
    );
  }
}


/**
 * Initiate Stripe Checkout for a paid tutor booking.
 * Returns the Stripe Checkout URL to redirect the student to.
 *
 * IMPORTANT: This calls the server-side edge function which validates
 * the booking ownership and creates the session. Never trust client-side
 * success callbacks alone — always verify via the webhook.
 */
export async function initiateTutorStripeCheckout(
  bookingId: string
): Promise<{ url: string; sessionId: string } | null> {
  const { data, error } = await supabase.functions.invoke("create-tutor-checkout", {
    body: { bookingId },
  });

  if (error) {
    console.error("Error initiating tutor checkout:", error);
    throw new Error(error.message || "Failed to initiate payment");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.url) {
    throw new Error("Payment service returned no checkout URL");
  }

  return { url: data.url, sessionId: data.sessionId };
}

/**
 * Verify a tutor booking payment after the student returns from Stripe Checkout.
 * This confirms the session ID from the redirect URL against Stripe's servers
 * via the server-side verify-payment edge function.
 *
 * Note: This is a secondary check. The webhook is the authoritative
 * payment confirmation and will update the booking automatically.
 * This function is used only to show the user immediate feedback on the
 * success page before the webhook fires.
 */
export async function verifyTutorBookingAfterCheckout(
  stripeSessionId: string
): Promise<{ confirmed: boolean; status: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("verify-payment", {
      body: { sessionId: stripeSessionId },
    });

    if (error) throw new Error(error.message);
    return { confirmed: data?.success === true, status: data?.status || "unknown" };
  } catch (err: any) {
    console.error("Error verifying tutor payment:", err);
    return { confirmed: false, status: "error" };
  }
}
