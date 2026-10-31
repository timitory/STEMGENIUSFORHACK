import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { audio } = await req.json();
    if (!audio) return new Response(JSON.stringify({ error: 'No audio provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const YARN_KEY = Deno.env.get('YARN_API_KEY');
    if (!YARN_KEY) throw new Error('YARN_API_KEY is not configured');

    const payload = { audio }; // base64 string
    const resp = await fetch('https://yarngpt.ai/api/v1/stt', { // <- replace if endpoint differs
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YARN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Yarn STT error', resp.status, detail);
      return new Response(JSON.stringify({ error: 'Yarn STT failed', detail }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const json = await resp.json();
    // Expecting: { text: '...' } — adapt if yarn returns different field
    const text = json.text ?? json.transcript ?? null;
    if (!text) return new Response(JSON.stringify({ error: 'No transcript returned' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Yarn STT function error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
