import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Constants for resource management
const REQUEST_TIMEOUT = 45000; // 45 seconds for pdf-converter (longer due to TTS)
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TTS_TEXT = 4000;
const MAX_RETRIES = 2;

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
    const { pdfUrl, conversionType } = await req.json();

    if (!pdfUrl || !conversionType) {
      throw new Error('PDF URL and conversion type are required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const YARNGPT_API_KEY = Deno.env.get('YARNGPT_API_KEY');
    if (!YARNGPT_API_KEY) {
      throw new Error('YARNGPT_API_KEY is not configured');
    }

    console.log('Step 1: Extracting text from PDF using AI...');

    // Fetch PDF with timeout and streaming to avoid memory issues
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
          // Exponential backoff: 500ms, 1s
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries - 1) * 500)
          );
        }
      }
    }

    if (retries === MAX_RETRIES) {
      throw new Error(`Failed to fetch PDF after ${MAX_RETRIES} attempts: ${lastError?.message}`);
    }

    // Use Lovable AI (Gemini) to extract text from the PDF
    const extractionPrompt = conversionType === 'video'
      ? `Extract ALL text content from this PDF document. Split it into logical pages/sections. Return as JSON: {"pages": ["page 1 text...", "page 2 text...", ...]}. Each page should be 2-4 sentences for good slide pacing. Extract the actual content, not descriptions.`
      : `Extract ALL text content from this PDF document. Return it as a single continuous text, preserving paragraph breaks. Do not describe the document - return the actual text content.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: extractionPrompt },
          { inline_data: { mime_type: "application/pdf", data: pdfBase64 } }
        ]
      }]
    };

    // Retry logic for AI extraction
    let aiResponse;
    retries = 0;
    lastError = null;

    while (retries < MAX_RETRIES) {
      try {
        aiResponse = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            timeout: REQUEST_TIMEOUT,
          }
        );
        break;
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries - 1) * 500)
          );
        }
      }
    }

    if (!aiResponse?.ok) {
      const errText = aiResponse ? await aiResponse.text() : lastError?.message;
      console.error('AI extraction error:', aiResponse?.status, errText);
      if (aiResponse?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse?.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error('Failed to extract text from PDF');
    }

    const aiData = await aiResponse.json();
    const extractedContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedContent || extractedContent.trim().length < 10) {
      throw new Error('Could not extract meaningful text from this PDF. It may be image-only or scanned.');
    }

    console.log('Text extracted successfully, length:', extractedContent.length);

    // Parse pages for video mode
    let pages: string[] = [];
    let fullText = extractedContent;

    if (conversionType === 'video') {
      try {
        // Try to parse JSON pages format
        const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          pages = parsed.pages || [];
        }
      } catch {
        // Fallback: split by paragraphs
        pages = extractedContent
          .split(/\n\n+/)
          .filter((p: string) => p.trim().length > 10)
          .map((p: string) => p.trim());
      }

      if (pages.length === 0) {
        // Split into chunks of ~200 chars
        const words = extractedContent.split(/\s+/);
        let current = '';
        for (const word of words) {
          if ((current + ' ' + word).length > 200 && current.length > 50) {
            pages.push(current.trim());
            current = word;
          } else {
            current += ' ' + word;
          }
        }
        if (current.trim()) pages.push(current.trim());
      }

      fullText = pages.join(' ');
    }

    // Limit text for TTS (Yarn GPT may have limits)
    const ttsText = fullText.substring(0, MAX_TTS_TEXT);

    console.log('Step 2: Converting text to audio via TTS...');

    // Retry logic for TTS
    let ttsResponse;
    retries = 0;
    lastError = null;

    while (retries < MAX_RETRIES) {
      try {
        ttsResponse = await fetchWithTimeout('https://yarngpt.ai/api/v1/tts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${YARNGPT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: ttsText,
            voice: 'Idera',
            response_format: 'mp3',
          }),
          timeout: REQUEST_TIMEOUT,
        });
        break;
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries - 1) * 500)
          );
        }
      }
    }

    if (!ttsResponse?.ok) {
      const errorText = ttsResponse ? await ttsResponse.text() : lastError?.message;
      console.error('TTS error:', ttsResponse?.status, errorText);
      throw new Error(`Text-to-speech conversion failed: ${ttsResponse?.status || 'timeout'}`);
    }

    // Stream audio response to avoid memory spikes
    let audioBase64 = "";
    if (ttsResponse.body) {
      const reader = ttsResponse.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          chunks.push(value);
        }
      } catch (streamError) {
        reader.cancel();
        throw streamError;
      }

      const audioBuffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      audioBase64 = base64Encode(audioBuffer);
    } else {
      const audioBuffer = await ttsResponse.arrayBuffer();
      audioBase64 = base64Encode(audioBuffer);
    }

    console.log('Audio generated successfully, size:', audioBase64.length / 1024, 'KB');

    if (conversionType === 'video') {
      // Return pages + audio for client-side slideshow
      return new Response(
        JSON.stringify({
          success: true,
          audioContent: audioBase64,
          pages,
          format: 'slideshow',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audio-only mode
    return new Response(
      JSON.stringify({
        success: true,
        audioContent: audioBase64,
        format: 'mp3',
        textPreview: ttsText.substring(0, 500),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pdf-converter:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
