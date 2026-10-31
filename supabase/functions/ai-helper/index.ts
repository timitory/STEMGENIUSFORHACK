import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, type, imageBase64, userId } = await req.json();

    if ((!prompt && !imageBase64) || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: (prompt or imageBase64) and type" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = type === 'homework'
      ? "You are an expert STEM tutor helping students with their homework. Analyze the image or text provided and solve the problem step-by-step. Provide clear, detailed explanations. Break down complex problems into simple steps. Be encouraging and supportive. Format your response clearly with numbered steps."
      : "You are a friendly STEM voice tutor. Explain concepts in a conversational, easy-to-understand way. Use analogies and real-world examples. Keep explanations concise but thorough.";

    const requestBody: any = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: []
    };

    if (imageBase64) {
      // Parse imageBase64, assume data:image/jpeg;base64,base64data
      const [mimePart, base64Data] = imageBase64.split(',');
      const mimeType = mimePart.split(':')[1].split(';')[0];
      requestBody.contents.push({
        parts: [
          { text: prompt || 'Please solve the problems shown in this image step by step.' },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      });
    } else {
      requestBody.contents.push({
        parts: [{ text: prompt }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI Gateway error');
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Save to database if userId is provided
    if (userId && type === 'homework') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('homework_sessions').insert({
        user_id: userId,
        question_text: prompt || 'Image-based question',
        response_text: aiResponse,
      });
    }

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in ai-helper function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
