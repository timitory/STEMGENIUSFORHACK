import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SYSTEM_PROMPT = `You are "STEM Genius AI", an expert, friendly, and patient conversational tutor and learning companion for students across Africa and worldwide.
Your mission:
- Help students master Science, Technology, Engineering, and Mathematics (STEM).
- Explain challenging concepts clearly, concisely, and step-by-step with real-world African and global examples and intuitive analogies.
- Support examination preparation (WAEC, JAMB UTME, NECO, Cambridge A-Levels, SAT, University STEM courses).
- Maintain conversational memory across the user's ongoing dialogue. Reference previous questions and answers naturally.
- Presentation and Formatting Guidelines:
  1. TABLES: Always use clean GitHub Flavored Markdown tables when comparing terms, properties, biological classifications, chemical reactions, physical units, or mathematical formulas.
  2. MIND MAPS & FLOWCHARTS: When explaining complex processes, hierarchical topics, reaction pathways, problem-solving algorithms, or system architectures, provide a clear visual diagram wrapped in a \`\`\`mermaid code block (e.g., using \`graph TD\`, \`flowchart TD\`, or \`mindmap\`).
  3. IMAGES & DIAGRAMS: ONLY include images or diagrams (using markdown format \`![Description](image_url)\` or SVG) when the user EXPLICITLY asks for an image, diagram, picture, or illustration in their question. Do not include random or unsolicited placeholder images.
  4. MATHEMATICS: Use LaTeX formatting for formulas: $...$ for inline math and $$...$$ for standalone display formulas.
  5. CODE: When asked for code or programming solutions, write clean, well-commented code inside tagged language code blocks.
- Never output dangerous, harmful, or misleading academic advice. Always encourage critical thinking.`;

function generateTitleFromMessage(message: string): string {
  const cleaned = message.trim().replace(/^["']|["']$/g, "").replace(/[\r\n]+/g, " ");
  if (cleaned.length <= 40) return cleaned;
  const words = cleaned.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).trim().length > 40) break;
    title = (title + " " + word).trim();
  }
  return title ? `${title}...` : cleaned.slice(0, 37) + "...";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId, message, attachments, model: requestedModel } = await req.json();

    if ((!message || typeof message !== "string" || !message.trim()) && (!attachments || attachments.length === 0)) {
      return new Response(JSON.stringify({ error: "A message or attachment is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in Supabase environment secrets");
    }

    const GEMINI_MODEL = requestedModel || Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    let activeConversationId = conversationId;
    let conversationTitle = "";

    // ─────────────────────────────────────────────────────────────────────────
    // 1. RESOLVE OR CREATE CONVERSATION
    // ─────────────────────────────────────────────────────────────────────────
    if (!activeConversationId) {
      conversationTitle = generateTitleFromMessage(message);
      const { data: newConv, error: convCreateErr } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: conversationTitle,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (convCreateErr || !newConv) {
        console.error("Error creating AI conversation:", convCreateErr);
        throw new Error("Failed to create new conversation");
      }
      activeConversationId = newConv.id;
    } else {
      // Validate ownership of existing conversation
      const { data: existingConv, error: convFetchErr } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", activeConversationId)
        .single();

      if (convFetchErr || !existingConv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingConv.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden: You cannot access another user's conversation" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      conversationTitle = existingConv.title;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. FETCH HISTORICAL CONVERSATION CONTEXT (Chronological Order)
    // ─────────────────────────────────────────────────────────────────────────
    const { data: historyMessages } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .limit(30); // Retain last 30 turns for rich context without exceeding token quotas

    // Build Gemini Multi-Turn Contents
    const contents: any[] = [];

    if (historyMessages && historyMessages.length > 0) {
      for (const msg of historyMessages) {
        // Gemini expects 'user' or 'model'
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role: role,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Append the current student message and any attachments
    const userParts: any[] = [];
    if (message && message.trim()) {
      userParts.push({ text: message.trim() });
    }

    // Process attached files (images, documents) for Gemini multimodal processing
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.dataUrl && typeof att.dataUrl === "string") {
          const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            userParts.push({
              inlineData: {
                mimeType: match[1] || att.type || "image/jpeg",
                data: match[2],
              },
            });
          }
        } else if (att.name) {
          userParts.push({
            text: `[Attached Document: ${att.name} (${att.type || "file"})]`,
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: userParts.length > 0 ? userParts : [{ text: "Hello" }],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CALL GEMINI API
    // ─────────────────────────────────────────────────────────────────────────
    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: DEFAULT_SYSTEM_PROMPT }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2500,
      },
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`Gemini API Error (${geminiRes.status}):`, errText);

      if (geminiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Gemini rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (geminiRes.status === 403 || geminiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Gemini quota or API access issue. Please verify API key configuration." }),
          { status: geminiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Gemini API call failed (${geminiRes.status})`);
    }

    const geminiData = await geminiRes.json();
    const assistantReply =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response. Please try asking again.";

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SAVE USER & ASSISTANT MESSAGES TO SUPABASE
    // ─────────────────────────────────────────────────────────────────────────
    const nowIso = new Date().toISOString();

    const { data: savedUserMsg, error: userMsgErr } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role: "user",
        content: message.trim() || "[Attached File]",
        metadata: { model: GEMINI_MODEL, attachments: attachments || [] },
        created_at: nowIso,
      })
      .select()
      .single();

    if (userMsgErr) {
      console.error("Failed to store user message:", userMsgErr);
    }

    const { data: savedAssistantMsg, error: asstMsgErr } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role: "assistant",
        content: assistantReply,
        metadata: {
          model: GEMINI_MODEL,
          finishReason: geminiData.candidates?.[0]?.finishReason,
          tokens: geminiData.usageMetadata,
        },
        created_at: new Date(Date.now() + 10).toISOString(),
      })
      .select()
      .single();

    if (asstMsgErr) {
      console.error("Failed to store assistant message:", asstMsgErr);
    }

    // Update conversation last_message_at timestamp
    await supabase
      .from("ai_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeConversationId);

    return new Response(
      JSON.stringify({
        conversationId: activeConversationId,
        conversationTitle: conversationTitle,
        userMessage: savedUserMsg || {
          id: `tmp-user-${Date.now()}`,
          conversation_id: activeConversationId,
          user_id: user.id,
          role: "user",
          content: message.trim(),
          created_at: nowIso,
        },
        assistantMessage: savedAssistantMsg || {
          id: `tmp-asst-${Date.now()}`,
          conversation_id: activeConversationId,
          user_id: user.id,
          role: "assistant",
          content: assistantReply,
          created_at: nowIso,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in gemini-chat function:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to process AI chat message" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

