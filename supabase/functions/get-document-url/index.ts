import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError) throw userError;
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { storagePath, download } = await req.json();
    if (!storagePath || typeof storagePath !== "string") {
      throw new Error("storagePath is required");
    }

    // Security: Ensure path is under submissions/ (no path traversal)
    const normalised = storagePath.replace(/\\/g, "/");
    if (!normalised.startsWith("submissions/") || normalised.includes("..")) {
      return new Response(
        JSON.stringify({ error: "Forbidden: invalid path" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Determine access rights:
    // 1. The user who submitted (own submission)
    // 2. An admin
    // 3. A premium user (can download published collections)
    const [{ data: submission }, { data: profile }, { data: adminRole }] = await Promise.all([
      serviceClient
        .from("user_submitted_collections")
        .select("submitted_by, status")
        .eq("document_url", storagePath)
        .maybeSingle(),
      serviceClient
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle(),
      serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const isAdmin = !!adminRole;
    const isOwner = submission?.submitted_by === user.id;
    const isPremium = profile?.is_premium === true;
    const isPublished = submission?.status === "published";

    // Admin and owner always have access.
    // For other users, only allow access to published collections for premium users.
    if (!isAdmin && !isOwner) {
      if (!isPublished) {
        return new Response(
          JSON.stringify({ error: "This document is not publicly available yet." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      if (!isPremium && download) {
        return new Response(
          JSON.stringify({ error: "Premium subscription required to download documents." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }

    // Generate signed URL (1 hour for viewing, 15 minutes for download)
    const expiresIn = download ? 900 : 3600;
    const { data: signedData, error: signError } = await serviceClient.storage
      .from("past-question-pdfs")
      .createSignedUrl(normalised, expiresIn, download ? { download: true } : undefined);

    if (signError) throw signError;
    if (!signedData?.signedUrl) throw new Error("Failed to generate signed URL");

    return new Response(
      JSON.stringify({ url: signedData.signedUrl, expiresIn }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

