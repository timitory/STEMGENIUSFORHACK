import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// YarnGPT voice names must be lowercase
const VOICE_NAME_MAP: Record<string, string> = {
  // English
  'Emma': 'emma', 'Zainab': 'zainab', 'Jude': 'jude', 'Mary': 'mary', 'Adam': 'adam',
  // Yoruba
  'Idera': 'idera', 'Wura': 'wura', 'Tayo': 'tayo', 'Remi': 'remi',
  // Igbo
  'Chinenye': 'chinenye', 'Adaora': 'adaora', 'Nonso': 'nonso', 'Femi': 'femi',
  // Hausa
  'Osagie': 'osagie', 'Regina': 'regina', 'Umar': 'umar',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const YARNGPT_API_KEY = Deno.env.get('YARNGPT_API_KEY');
    if (!YARNGPT_API_KEY) {
      console.error('YARNGPT_API_KEY secret not set in Supabase Edge Function secrets');
      return new Response(
        JSON.stringify({ error: 'TTS service not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalise voice to lowercase as required by YarnGPT API
    const rawVoice = voice || 'zainab';
    const normalisedVoice = VOICE_NAME_MAP[rawVoice] || rawVoice.toLowerCase();

    // Truncate text to 15,000 chars (YarnGPT per-request limit)
    const truncatedText = text.trim().substring(0, 15000);

    console.log(`YarnGPT TTS: voice="${normalisedVoice}", text_length=${truncatedText.length}`);

    // ─── Step 1: Mint a streaming ticket (fast path) ───────────────────────
    const prepareResponse = await fetch('https://api.yarngpt.ai/api/v1/tts/prepare', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YARNGPT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: truncatedText,
        voice: normalisedVoice,
        output_format: 'mp3',
      }),
    });

    if (!prepareResponse.ok) {
      const errorText = await prepareResponse.text().catch(() => '');
      console.error(`YarnGPT prepare error: HTTP ${prepareResponse.status}`, errorText);

      // Provide clear diagnosis without leaking key
      if (prepareResponse.status === 401 || prepareResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: 'TTS authentication failed. API key may be invalid or expired.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (prepareResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'TTS service credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (prepareResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: `Voice "${normalisedVoice}" not found. Please select a supported voice.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (prepareResponse.status === 503) {
        return new Response(
          JSON.stringify({ error: 'TTS service temporarily unavailable. Please try again.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `TTS prepare failed: HTTP ${prepareResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prepareData = await prepareResponse.json();
    const { ticket, stream_url } = prepareData;

    if (!ticket || !stream_url) {
      console.error('YarnGPT prepare response missing ticket/stream_url:', prepareData);
      return new Response(
        JSON.stringify({ error: 'TTS service returned unexpected response format.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`YarnGPT ticket obtained, fetching stream: ${stream_url}`);

    // ─── Step 2: Fetch the binary audio stream using the ticket ────────────
    // Ticket URL may be relative — always use api.yarngpt.ai base
    const streamEndpoint = stream_url.startsWith('http')
      ? stream_url
      : `https://api.yarngpt.ai${stream_url}`;

    // Note: No Authorization header needed — ticket acts as temporary credential
    const streamResponse = await fetch(streamEndpoint, {
      method: 'GET',
    });

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text().catch(() => '');
      console.error(`YarnGPT stream error: HTTP ${streamResponse.status}`, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to retrieve audio stream: HTTP ${streamResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 3: Convert binary audio to base64 ────────────────────────────
    const arrayBuffer = await streamResponse.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      console.error('YarnGPT returned empty audio buffer');
      return new Response(
        JSON.stringify({ error: 'TTS service returned empty audio.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 in chunks to avoid stack overflow on large files
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    console.log(`YarnGPT TTS success: ${arrayBuffer.byteLength} bytes → base64 length ${base64Audio.length}`);

    return new Response(
      JSON.stringify({ audioContent: base64Audio, mimeType: 'audio/mpeg' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // Never log the API key — only log the message
    console.error('Error in text-to-speech function:', error?.message || String(error));
    return new Response(
      JSON.stringify({ error: 'Text-to-speech processing failed. Please try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});