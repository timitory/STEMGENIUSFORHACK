import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract text from various file types
async function extractTextFromFile(file: File, geminiKey: string): Promise<string> {
  const mimeType = file.type;
  const arrayBuffer = await file.arrayBuffer();

  // Text file - direct extraction
  if (mimeType === 'text/plain') {
    return new TextDecoder().decode(arrayBuffer);
  }

  // PDF files - use pdfjs library
  if (mimeType === 'application/pdf') {
    try {
      const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let text = '';
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text || 'PDF loaded but no text could be extracted.';
    } catch (err) {
      console.error('PDF extraction error:', err);
      return 'Could not extract text from PDF. Please try converting to text or using another format.';
    }
  }

  // Word documents (.docx, .doc)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword') {
    try {
      const mammoth = await import('https://cdn.jsdelivr.net/npm/mammoth@1.4.18/mammoth.browser.min.js');
      const result = await mammoth.convertToHtml({ arrayBuffer });
      // Strip HTML tags and return text
      const plainText = result.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      return plainText || 'Document loaded but no text could be extracted.';
    } catch (err) {
      console.error('Word document extraction error:', err);
      return 'Could not extract text from document. Please try copying the text manually.';
    }
  }

  // Images - use Gemini Vision to extract text (OCR)
  if (mimeType.startsWith('image/')) {
    try {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Extract all text from this image. Return only the text content, nothing else.' },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64
                  }
                }
              ]
            }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini Vision API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text || 'Could not extract text from image.';
    } catch (err) {
      console.error('Image text extraction error:', err);
      return 'Could not extract text from image. Please try a different format.';
    }
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let subject: string | undefined;
    let topic: string | undefined;
    let documentText: string | undefined;
    let numberOfCards: number | undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      if (file) {
        documentText = await extractTextFromFile(file, GEMINI_API_KEY);
      }
      
      subject = formData.get('subject') as string || undefined;
      topic = formData.get('topic') as string || undefined;
      numberOfCards = parseInt(formData.get('numberOfCards') as string) || undefined;
    } else {
      const jsonData = await req.json();
      subject = jsonData.subject;
      topic = jsonData.topic;
      documentText = jsonData.documentText;
      numberOfCards = jsonData.numberOfCards;
    }

    if (!subject && !documentText) {
      return new Response(
        JSON.stringify({ error: "Please provide a subject/topic or document text" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const count = numberOfCards || 15;

    let userPrompt: string;
    if (documentText) {
      userPrompt = `Based on the following document content, generate exactly ${count} flashcards that cover the key concepts, definitions, and important facts:\n\n${documentText.slice(0, 8000)}`;
    } else {
      userPrompt = `Generate exactly ${count} flashcards about ${subject}${topic ? ` focusing on ${topic}` : ''}. Cover key concepts, definitions, formulas, and important facts.`;
    }

    const systemPrompt = `You are an expert STEM educator creating study flashcards. Generate exactly ${count} flashcards.

Each flashcard should have:
- A clear, concise question or term on the front
- A detailed but succinct answer or definition on the back

IMPORTANT: Return ONLY valid JSON in this exact format, no additional text:
{
  "flashcards": [
    {
      "front": "Question or term here",
      "back": "Answer or definition here"
    }
  ]
}

Make flashcards progressively harder. Mix question types: definitions, explanations, applications, and comparisons.`;

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
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in AI response');
    }

    let flashcards;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flashcards = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
      throw new Error('Failed to parse AI response');
    }

    return new Response(JSON.stringify(flashcards), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in generate-flashcards function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
