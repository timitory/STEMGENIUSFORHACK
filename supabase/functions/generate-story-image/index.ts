import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, storyTitle, pageIndex } = await req.json();

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const imagePrompt = `Create a vivid, colorful digital illustration for a children's educational story. Scene: ${prompt}. Style: Rich African-inspired art, warm vibrant colors, magical atmosphere, educational and inspiring. No text or words in the image.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      }
    );

    if (!response.ok) {
      console.error('Image generation error:', response.status);
      throw new Error('Failed to generate image');
    }

    const data = await response.json();
    const imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;

    if (!imageUrl) throw new Error('No image generated');

    // Upload to Supabase storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Decode base64
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const fileName = `story-images/${Date.now()}-page-${pageIndex}.png`;

    const { error: uploadError } = await supabase.storage
      .from('story-assets')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Return the base64 directly as fallback
      return new Response(JSON.stringify({ imageUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: publicUrl } = supabase.storage.from('story-assets').getPublicUrl(fileName);

    return new Response(JSON.stringify({ imageUrl: publicUrl.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error generating story image:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate image' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
