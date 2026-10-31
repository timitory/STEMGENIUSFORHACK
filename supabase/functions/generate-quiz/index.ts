import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for resource management
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_DOCUMENT_SIZE = 8000; // Max chars to send to Gemini
const MAX_RETRIES = 3;

// Streaming fetch wrapper with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const timeout = options.timeout || REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic, section, difficulty, numberOfQuestions, documentText, pdfUrl } = await req.json();
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    let systemPrompt;
    let requestBody;

    if (pdfUrl) {
      // Handle PDF document processing with streaming
      systemPrompt = `You are an expert STEM educator. Analyze the provided PDF document and create exactly ${numberOfQuestions || 10} multiple-choice questions based ONLY on the content found in this PDF.

CRITICAL REQUIREMENTS:
1. Questions must be directly based on information, concepts, or facts from the PDF
2. Do not create questions about topics not mentioned in the PDF
3. Use specific details, examples, or terminology from the PDF content
4. Each question must test understanding of the PDF's actual content

Each question should:
- Be clear and educational
- Have exactly 4 options (A, B, C, D)
- Have only one correct answer
- Include a brief explanation citing the relevant part of the PDF

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation why this is correct, citing the PDF content",
      "points": ${difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20}
    }
  ]
}`;

      // Fetch PDF with timeout and stream to base64 (avoid loading entire file to memory at once)
      let pdfBase64 = "";
      let retries = 0;
      let lastError = null;

      while (retries < MAX_RETRIES) {
        try {
          const pdfResponse = await fetchWithTimeout(pdfUrl, { 
            timeout: REQUEST_TIMEOUT 
          });
          
          if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
          }

          // Stream the response rather than loading entire buffer
          if (pdfResponse.body) {
            const reader = pdfResponse.body.getReader();
            const chunks: Uint8Array[] = [];
            let totalSize = 0;
            const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB limit

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                totalSize += value.length;
                if (totalSize > MAX_PDF_SIZE) {
                  throw new Error(`PDF file exceeds ${MAX_PDF_SIZE / 1024 / 1024}MB limit`);
                }
                chunks.push(value);
              }
            } catch (streamError) {
              reader.cancel();
              throw streamError;
            }

            // Concatenate chunks
            const pdfBuffer = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
              pdfBuffer.set(chunk, offset);
              offset += chunk.length;
            }
            pdfBase64 = base64Encode(pdfBuffer);
          } else {
            const pdfBuffer = await pdfResponse.arrayBuffer();
            pdfBase64 = base64Encode(pdfBuffer);
          }
          
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          retries++;
          if (retries < MAX_RETRIES) {
            // Exponential backoff: 500ms, 1s, 2s
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, retries - 1) * 500)
            );
          }
        }
      }

      if (retries === MAX_RETRIES) {
        throw new Error(`Failed to fetch PDF after ${MAX_RETRIES} attempts: ${lastError?.message}`);
      }

      requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [
            { text: `Analyze this PDF document and generate ${numberOfQuestions || 10} questions based on its content.` },
            { 
              inline_data: { 
                mime_type: "application/pdf", 
                data: pdfBase64 
              } 
            }
          ]
        }]
      };
    } else if (documentText) {
      // Handle pasted text content - limit size to prevent memory issues
      const truncatedText = documentText.substring(0, MAX_DOCUMENT_SIZE);
      
      systemPrompt = `You are an expert STEM educator creating quiz questions from the provided document content. Generate exactly ${numberOfQuestions || 10} multiple-choice questions based on the following document:

${truncatedText}

Each question should:
1. Be clear and educational
2. Have exactly 4 options
3. Have only one correct answer
4. Include a brief explanation for the correct answer
5. Be directly based on the content provided

IMPORTANT: Return ONLY valid JSON in this exact format, no additional text:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation why this is correct",
      "points": ${difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20}
    }
  ]
}`;

      requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: `Generate ${numberOfQuestions || 10} ${difficulty || 'medium'} difficulty questions based on the provided document content.` }]
        }]
      };
    } else {
      // Handle traditional subject/topic based generation
      systemPrompt = `You are an expert STEM educator creating quiz questions. Generate exactly ${numberOfQuestions || 10} multiple-choice questions based on the following criteria:
- Subject: ${subject}
${topic ? `- Topic: ${topic}` : ''}
${section ? `- Section/Chapter: ${section}` : ''}
- Difficulty: ${difficulty || 'medium'}

Each question should:
1. Be clear and educational
2. Have exactly 4 options
3. Have only one correct answer
4. Include a brief explanation for the correct answer

IMPORTANT: Return ONLY valid JSON in this exact format, no additional text:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation why this is correct",
      "points": ${difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20}
    }
  ]
}

For difficulty:
- easy: basic recall questions (10 points each)
- medium: application questions (20 points each)
- hard: analysis and synthesis questions (30 points each)`;

      requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: `Generate ${numberOfQuestions || 10} ${difficulty || 'medium'} difficulty questions about ${subject}${topic ? ` focusing on ${topic}` : ''}${section ? ` in the ${section} section` : ''}.` }]
        }]
      };
    }

    // Call Gemini API with timeout and retry logic
    let response;
    let retries = 0;
    let lastError = null;

    while (retries < MAX_RETRIES) {
      try {
        response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            timeout: REQUEST_TIMEOUT,
          }
        );
        break; // Success
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < MAX_RETRIES) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries - 1) * 500)
          );
        }
      }
    }

    if (!response?.ok) {
      const errorText = response ? await response.text() : lastError?.message;
      console.error('AI Gateway error:', response?.status, errorText);
      
      if (response?.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response?.status === 402) {
        return new Response(JSON.stringify({ error: 'Service credits exhausted. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response?.status || 'timeout'}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let questions;
    try {
      // Strip markdown code fences if present
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      // Extract the outermost JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
      throw new Error('Failed to parse AI response. Please try again.');
    }

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in generate-quiz function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
