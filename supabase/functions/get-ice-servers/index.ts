/**
 * get-ice-servers — Supabase Edge Function
 *
 * Returns live STUN + TURN ICE server configurations for authenticated users.
 * Uses Metered.ca (stem-genius) with dynamic time-limited tokens and static backup.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Public STUN servers
const STUN_SERVERS = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

// Static fallback TURN credentials in case Metered API has a transient timeout
const STATIC_FALLBACK_SERVERS = [
  { urls: "turn:global.relay.metered.ca:80", username: "4caa0044d153626e095b46d0", credential: "0peofI0trQPVQv+t" },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "4caa0044d153626e095b46d0", credential: "0peofI0trQPVQv+t" },
  { urls: "turn:global.relay.metered.ca:443", username: "4caa0044d153626e095b46d0", credential: "0peofI0trQPVQv+t" },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "4caa0044d153626e095b46d0", credential: "0peofI0trQPVQv+t" },
];

async function fetchDynamicTurnServers(appName: string, secretKey: string): Promise<any[]> {
  try {
    const res = await fetch(`https://${appName}.metered.live/api/v1/turn/credential?secretKey=${secretKey}`, {
      method: "POST",
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const cred = await res.json();
      if (cred?.username && cred?.password) {
        return [
          { urls: "turn:global.relay.metered.ca:80", username: cred.username, credential: cred.password },
          { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: cred.username, credential: cred.password },
          { urls: "turn:global.relay.metered.ca:443", username: cred.username, credential: cred.password },
          { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: cred.username, credential: cred.password },
        ];
      }
    }
  } catch (err) {
    console.warn("[get-ice-servers] Dynamic fetch error:", err);
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userErr,
    } = await supabaseClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appName = Deno.env.get("METERED_APP_NAME") || "stem-genius";
    const secretKey = Deno.env.get("METERED_API_KEY") || "eTgHJ6Qk0MeF6HGtDn-tJbhlSQ9_zDN_ahClixdBJZT77fZa";

    const dynamicTurn = await fetchDynamicTurnServers(appName, secretKey);
    const turnServers = dynamicTurn.length > 0 ? dynamicTurn : STATIC_FALLBACK_SERVERS;

    const iceServers = [...STUN_SERVERS, ...turnServers];

    return new Response(
      JSON.stringify({
        iceServers,
        hasTurn: true,
        provider: "metered",
        ttl: 3600,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[get-ice-servers] Handler error:", err);
    return new Response(
      JSON.stringify({
        iceServers: [...STUN_SERVERS, ...STATIC_FALLBACK_SERVERS],
        hasTurn: true,
        provider: "metered-static-fallback",
        error: err.message,
        ttl: 3600,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
