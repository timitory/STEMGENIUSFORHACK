import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, culture, subject, difficulty } = await req.json();

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const systemPrompt = `You are a master storyteller and STEM educator specializing in African cultural narratives. You create immersive, educational stories that weave real STEM concepts into rich African cultural settings.

Your stories must:
- Be engaging, vivid, and culturally authentic
- Teach real STEM concepts through narrative
- Include dialogue between characters
- Be appropriate for students aged 12-18
- Feel like a real story, not a textbook

You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;

    const userPrompt = `Create an educational STEM story with these parameters:
- Topic: ${topic}
- Cultural Setting: ${culture}
- STEM Subject: ${subject}
- Difficulty: ${difficulty}

Return this exact JSON structure:
{
  "title": "Story title",
  "subtitle": "A short poetic subtitle",
  "culturalContext": "Brief cultural context label",
  "introduction": "A vivid 2-3 sentence scene-setting introduction",
  "pages": [
    "Page 1 content - 3-4 paragraphs of story with dialogue",
    "Page 2 content - 3-4 paragraphs continuing the story",
    "Page 3 content - 3-4 paragraphs with the climax",
    "Page 4 content - 3-4 paragraphs with resolution and STEM reveal",
    "Page 5 content - 3-4 paragraphs wrapping up with reflection"
  ],
  "imagePrompts": [
    "Brief visual scene description for page 1 illustration (max 20 words)",
    "Brief visual scene description for page 2 illustration (max 20 words)",
    "Brief visual scene description for page 3 illustration (max 20 words)",
    "Brief visual scene description for page 4 illustration (max 20 words)",
    "Brief visual scene description for page 5 illustration (max 20 words)"
  ],
  "stemConcept": "Detailed explanation of the STEM concept taught (2-3 paragraphs)",
  "culturalTieIn": "How this connects to real African cultural/scientific heritage (2-3 paragraphs)",
  "quiz": [
    {
      "question": "Question about the STEM concept from the story",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is the correct answer"
    },
    {
      "question": "Second question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Why this is correct"
    },
    {
      "question": "Third question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 2,
      "explanation": "Why this is correct"
    }
  ],
  "funFact": "An interesting related fact about African science/culture"
}`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userPrompt }]
      }]
    };

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI Gateway error');
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('No response from AI');

    // Clean markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const story = JSON.parse(content);

    return new Response(JSON.stringify({ story }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-story:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate story' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
