import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: base64Url encode string/Uint8Array
function base64UrlEncode(data: Uint8Array | string): string {
  let base64 = "";
  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    let binary = "";
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Helper: Generate Zoom Meeting SDK Signature (HMAC-SHA256)
async function generateMeetingSignature(
  sdkKey: string,
  sdkSecret: string,
  meetingNumber: string | number,
  role: number
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours validity

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sdkKey: sdkKey,
    appKey: sdkKey,
    mn: String(meetingNumber),
    role: role, // 1 for host, 0 for attendee
    iat: iat,
    exp: exp,
    tokenExp: exp,
  };

  const headerStr = base64UrlEncode(JSON.stringify(header));
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerStr}.${payloadStr}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sdkSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(unsignedToken));
  const signatureStr = base64UrlEncode(new Uint8Array(signature));

  return `${unsignedToken}.${signatureStr}`;
}

// Helper: Fetch Zoom Server-to-Server OAuth Access Token
async function getZoomAccessToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Zoom OAuth error:", response.status, errText);
    throw new Error(`Failed to authenticate with Zoom: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    // Zoom Credentials from Supabase Secrets
    const ZOOM_ACCOUNT_ID = Deno.env.get("ZOOM_ACCOUNT_ID") || "";
    const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID") || "";
    const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET") || "";
    const ZOOM_SDK_KEY = Deno.env.get("ZOOM_SDK_KEY") || ZOOM_CLIENT_ID;
    const ZOOM_SDK_SECRET = Deno.env.get("ZOOM_SDK_SECRET") || ZOOM_CLIENT_SECRET;

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: CREATE ZOOM MEETING / WEBINAR
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "create-meeting") {
      const { classId, title, description, scheduledStart, durationMinutes, meetingFormat, passcode } = payload;

      if (!classId || !title) {
        return new Response(JSON.stringify({ error: "Missing required meeting parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user is host or admin
      const { data: classRow, error: classFetchErr } = await supabase
        .from("virtual_classes")
        .select("*, host:host_id(name)")
        .eq("id", classId)
        .single();

      if (classFetchErr || !classRow) {
        return new Response(JSON.stringify({ error: "Virtual class record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (classRow.host_id !== user.id) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Forbidden: Only the class host or admin can create Zoom meetings" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Prevent duplicate creation if zoom_numeric_id is already present
      if (classRow.zoom_numeric_id) {
        return new Response(
          JSON.stringify({
            message: "Zoom meeting already exists for this class",
            meetingId: classRow.zoom_meeting_id,
            numericId: classRow.zoom_numeric_id,
            joinUrl: classRow.zoom_join_url,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let zoomMeetingData: any = null;

      // If Zoom credentials are configured, create the real Zoom meeting via REST API
      if (ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET) {
        try {
          const accessToken = await getZoomAccessToken(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET);

          // Type 2 = Scheduled Meeting, 5 = Webinar
          const zoomType = meetingFormat === "webinar" ? 5 : 2;
          const apiPath = zoomType === 5 ? "https://api.zoom.us/v2/users/me/webinars" : "https://api.zoom.us/v2/users/me/meetings";

          const zoomReqBody = {
            topic: `STEM Genius: ${title}`,
            type: zoomType,
            start_time: new Date(scheduledStart || Date.now()).toISOString(),
            duration: durationMinutes || 90,
            timezone: "Africa/Lagos",
            agenda: description || "STEM Genius Interactive Virtual Class",
            password: passcode || Math.random().toString(36).slice(-6),
            settings: {
              host_video: true,
              participant_video: meetingFormat !== "webinar",
              join_before_host: false,
              mute_upon_entry: true,
              watermark: false,
              use_pmi: false,
              approval_type: 0, // Automatically approve
              audio: "both",
              auto_recording: "cloud", // Auto cloud recording enabled
              waiting_room: false,
              registrants_email_notification: false,
            },
          };

          const zoomRes = await fetch(apiPath, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(zoomReqBody),
          });

          if (!zoomRes.ok) {
            const errBody = await zoomRes.text();
            console.error("Zoom Meeting creation failed:", zoomRes.status, errBody);
            throw new Error(`Zoom API error (${zoomRes.status}): ${errBody}`);
          }

          zoomMeetingData = await zoomRes.json();
        } catch (zoomErr: any) {
          console.error("Error creating meeting via Zoom REST API:", zoomErr);
          throw zoomErr;
        }
      } else {
        // Fallback / Sandbox placeholder when environment credentials are being setup
        console.warn("ZOOM credentials not configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET.");
        const fallbackMeetingNum = Math.floor(10000000000 + Math.random() * 90000000000);
        zoomMeetingData = {
          id: fallbackMeetingNum,
          uuid: `stem-${Date.now()}`,
          join_url: `https://zoom.us/j/${fallbackMeetingNum}`,
          start_url: `https://zoom.us/s/${fallbackMeetingNum}`,
          password: passcode || "stem123",
          host_id: "stem-genius-host",
        };
      }

      // Update virtual_classes in Supabase
      const updatePayload = {
        zoom_meeting_id: String(zoomMeetingData.id),
        zoom_numeric_id: Number(zoomMeetingData.id),
        zoom_uuid: zoomMeetingData.uuid,
        zoom_join_url: zoomMeetingData.join_url,
        zoom_start_url: zoomMeetingData.start_url,
        zoom_passcode: zoomMeetingData.password,
        zoom_host_id: zoomMeetingData.host_id,
        zoom_recording_status: "not_started",
        zoom_metadata: zoomMeetingData,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedClass, error: updateErr } = await supabase
        .from("virtual_classes")
        .update(updatePayload)
        .eq("id", classId)
        .select()
        .single();

      if (updateErr) {
        console.error("Failed to update virtual class with Zoom details:", updateErr);
        throw updateErr;
      }

      return new Response(
        JSON.stringify({
          success: true,
          meeting: updatedClass,
          zoomNumericId: zoomMeetingData.id,
          passcode: zoomMeetingData.password,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: GET MEETING SDK SIGNATURE FOR EMBEDDED IN-APP SESSION
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get-signature") {
      const { classId } = payload;

      if (!classId) {
        return new Response(JSON.stringify({ error: "Missing classId parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch class details
      const { data: classRow, error: classErr } = await supabase
        .from("virtual_classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (classErr || !classRow) {
        return new Response(JSON.stringify({ error: "Class not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine Role: 1 for Host, 0 for Attendee
      const isHost = classRow.host_id === user.id;
      let role = isHost ? 1 : 0;

      // If user is not the host, verify registration or permissions
      if (!isHost) {
        if (classRow.access_type === "registered_only") {
          const { data: reg } = await supabase
            .from("class_registrations")
            .select("id")
            .eq("class_id", classId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!reg) {
            return new Response(JSON.stringify({ error: "Registration required before entering this session" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Fetch User's Display Name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      const userName = profile?.name || user.email?.split("@")[0] || (isHost ? "Host" : "Student");
      const meetingNumber = classRow.zoom_numeric_id || classRow.zoom_meeting_id;

      if (!meetingNumber) {
        return new Response(JSON.stringify({ error: "Zoom meeting has not yet been provisioned for this class" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate SDK signature securely
      let signature = "";
      if (ZOOM_SDK_KEY && ZOOM_SDK_SECRET) {
        signature = await generateMeetingSignature(ZOOM_SDK_KEY, ZOOM_SDK_SECRET, meetingNumber, role);
      } else {
        // Fallback signature for sandbox testing
        signature = `mock-signature-${Date.now()}`;
      }

      return new Response(
        JSON.stringify({
          success: true,
          signature: signature,
          sdkKey: ZOOM_SDK_KEY,
          meetingNumber: String(meetingNumber),
          passCode: classRow.zoom_passcode || "",
          userName: userName,
          userEmail: user.email || "",
          role: role,
          isHost: isHost,
          meetingFormat: classRow.meeting_format,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 3: FETCH CLOUD RECORDINGS FROM ZOOM
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get-recordings") {
      const { classId } = payload;
      const { data: classRow } = await supabase
        .from("virtual_classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (!classRow || !classRow.zoom_numeric_id) {
        return new Response(JSON.stringify({ error: "No Zoom session found for this class" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Zoom credentials not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = await getZoomAccessToken(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET);
      const res = await fetch(`https://api.zoom.us/v2/meetings/${classRow.zoom_numeric_id}/recordings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Zoom recordings API error: ${err}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recordingData = await res.json();

      return new Response(JSON.stringify({ success: true, recordings: recordingData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Zoom function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

