import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp",
};

// Helper: Compute HMAC SHA-256 in hex
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZOOM_WEBHOOK_SECRET_TOKEN = Deno.env.get("ZOOM_WEBHOOK_SECRET_TOKEN") || Deno.env.get("ZOOM_CLIENT_SECRET") || "";

    const bodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ZOOM URL VALIDATION / CHALLENGE-RESPONSE (CRC)
    // ─────────────────────────────────────────────────────────────────────────
    if (body.event === "endpoint.url_validation") {
      const plainToken = body.payload?.plainToken;
      if (!plainToken) {
        return new Response(JSON.stringify({ error: "Missing plainToken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encryptedToken = await hmacSha256Hex(ZOOM_WEBHOOK_SECRET_TOKEN, plainToken);

      return new Response(
        JSON.stringify({
          plainToken: plainToken,
          encryptedToken: encryptedToken,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. WEBHOOK SIGNATURE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    const zmSignature = req.headers.get("x-zm-signature");
    const zmTimestamp = req.headers.get("x-zm-request-timestamp");

    if (ZOOM_WEBHOOK_SECRET_TOKEN && zmSignature && zmTimestamp) {
      const messageToHash = `v0:${zmTimestamp}:${bodyText}`;
      const expectedHash = `v0=${await hmacSha256Hex(ZOOM_WEBHOOK_SECRET_TOKEN, messageToHash)}`;

      if (expectedHash !== zmSignature) {
        console.warn("Invalid Zoom webhook signature. Expected:", expectedHash, "Received:", zmSignature);
        return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event = body.event;
    const payload = body.payload?.object || {};
    const meetingId = payload.id ? String(payload.id) : null;

    console.info(`[Zoom Webhook] Event: ${event}, Meeting ID: ${meetingId}`);

    if (!meetingId) {
      return new Response(JSON.stringify({ message: "No meeting ID associated with event, skipping." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup matching virtual_class by zoom_meeting_id or zoom_numeric_id
    const { data: virtualClass, error: findClassErr } = await supabase
      .from("virtual_classes")
      .select("id, title, status, is_recording_enabled")
      .or(`zoom_meeting_id.eq.${meetingId},zoom_numeric_id.eq.${meetingId}`)
      .maybeSingle();

    if (findClassErr) {
      console.error("Error finding virtual_class for meetingId:", meetingId, findClassErr);
    }

    if (!virtualClass) {
      console.warn(`[Zoom Webhook] No STEM Genius class linked to Zoom meeting ${meetingId}`);
      return new Response(JSON.stringify({ message: "Meeting not associated with STEM Genius" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EVENT PROCESSING
    // ─────────────────────────────────────────────────────────────────────────

    // Event: Meeting Started
    if (event === "meeting.started" || event === "webinar.started") {
      await supabase
        .from("virtual_classes")
        .update({
          status: "live",
          actual_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", virtualClass.id);
    }

    // Event: Meeting Ended
    else if (event === "meeting.ended" || event === "webinar.ended") {
      await supabase
        .from("virtual_classes")
        .update({
          status: "ended",
          actual_ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", virtualClass.id);
    }

    // Event: Recording Started
    else if (event === "recording.started") {
      await supabase
        .from("virtual_classes")
        .update({
          zoom_recording_status: "recording",
          updated_at: new Date().toISOString(),
        })
        .eq("id", virtualClass.id);
    }

    // Event: Recording Stopped
    else if (event === "recording.stopped") {
      await supabase
        .from("virtual_classes")
        .update({
          zoom_recording_status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", virtualClass.id);
    }

    // Event: Recording Completed (Files ready for download/playback)
    else if (event === "recording.completed") {
      const recordingFiles = payload.recording_files || [];
      const playUrl = payload.share_url || payload.recording_play_url || "";
      const durationSeconds = (payload.duration || 0) * 60;
      const totalSizeBytes = payload.total_size || 0;

      // Find primary mp4 video file if present
      const mp4File = recordingFiles.find((f: any) => f.file_type === "MP4" || f.file_extension === "MP4");
      const videoDownloadUrl = mp4File?.download_url || "";

      // Update virtual_classes status
      await supabase
        .from("virtual_classes")
        .update({
          zoom_recording_status: "available",
          updated_at: new Date().toISOString(),
        })
        .eq("id", virtualClass.id);

      // Upsert into class_recordings
      const recordingRecord = {
        class_id: virtualClass.id,
        recording_title: `${virtualClass.title} (Cloud Recording)`,
        video_url: videoDownloadUrl || playUrl,
        thumbnail_url: null,
        duration_seconds: durationSeconds,
        file_size_bytes: totalSizeBytes,
        status: "ready",
        access_permission: "registered_attendees",
        ready_at: new Date().toISOString(),
        zoom_recording_id: String(payload.id || ""),
        zoom_play_url: playUrl,
        zoom_download_url: videoDownloadUrl,
        zoom_share_url: payload.share_url || null,
        zoom_recording_files: recordingFiles,
      };

      const { error: recInsertErr } = await supabase
        .from("class_recordings")
        .insert(recordingRecord);

      if (recInsertErr) {
        console.error("Failed to insert class recording:", recInsertErr);
      } else {
        console.info(`[Zoom Webhook] Successfully registered recording for class ${virtualClass.id}`);
      }
    }

    return new Response(JSON.stringify({ success: true, event: event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Zoom webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

