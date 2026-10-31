import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interests, skills, educationLevel, location, careerGoals } = await req.json();

    if (!interests || !skills || !educationLevel) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const systemPrompt = `You are an expert STEM career coach specializing in Nigerian and African education systems. 
Provide comprehensive career guidance including:
1. Recommended career paths based on interests and skills
2. Required qualifications and certifications
3. Top universities and institutions (prioritize Nigerian institutions like UI, OAU, UNILAG, ABU, FUTO, etc.)
4. International scholarship opportunities
5. Industry trends and job market outlook
6. Recommended courses and skills to develop
7. Internship and networking opportunities
8. Salary expectations and career progression

Format your response in clear sections with specific, actionable recommendations.`;

    const userPrompt = `User Profile:
- Interests: ${interests.join(", ")}
- Skills: ${skills.join(", ")}
- Education Level: ${educationLevel}
- Location: ${location || "Nigeria"}
- Career Goals: ${careerGoals || "Not specified"}

Please provide detailed career coaching based on this profile.`;

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
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const recommendations = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!recommendations) {
      throw new Error("No recommendations generated");
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in career-coach function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});