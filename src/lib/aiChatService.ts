/**
 * AI Chat Service
 * Handles conversation management, persistent message history, and interactions
 * with the Gemini AI backend.
 */

import { supabase } from "@/integrations/supabase/client";
import { AIChatConversation, AIChatMessage, ChatAttachment, SendMessageResponse } from "@/types/aiChat";

function generateTitleFromMessage(message: string): string {
  const cleaned = (message || "New Topic").trim().replace(/^["']|["']$/g, "").replace(/[\r\n]+/g, " ");
  if (cleaned.length <= 36) return cleaned;
  const words = cleaned.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).trim().length > 36) break;
    title = (title + " " + word).trim();
  }
  return title ? `${title}...` : cleaned.slice(0, 33) + "...";
}

/**
 * Fetch all conversations for the current user, ordered by most recently active.
 */
export async function fetchUserConversations(): Promise<AIChatConversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Error fetching AI conversations:", error);
    throw error;
  }

  return (data || []) as AIChatConversation[];
}

/**
 * Fetch full message history for an active conversation in chronological order.
 */
export async function fetchConversationMessages(conversationId: string): Promise<AIChatMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching AI messages:", error);
    throw error;
  }

  return (data || []) as AIChatMessage[];
}

/**
 * Send a message to the persistent Gemini conversational backend.
 * Falls back seamlessly to the existing active `ai-helper` Gemini function if `gemini-chat` is deploying.
 */
export async function sendChatMessage(
  message: string,
  conversationId?: string,
  attachments?: ChatAttachment[],
  model?: string
): Promise<SendMessageResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to chat with STEM Genius AI");
  }

  // 1. First attempt: Dedicated multi-turn gemini-chat function
  try {
    const { data, error } = await supabase.functions.invoke("gemini-chat", {
      body: {
        conversationId: conversationId || null,
        message: message.trim(),
        attachments: attachments || [],
        model: model || undefined,
      },
    });

    if (!error && data?.assistantMessage) {
      return data as SendMessageResponse;
    }
    console.warn("gemini-chat invocation returned notice, attempting ai-helper fallback:", error || data?.error);
  } catch (fnErr) {
    console.warn("gemini-chat function invocation exception, proceeding to ai-helper fallback:", fnErr);
  }

  // 2. Fallback: Use the existing active ai-helper Gemini endpoint + direct database persistence
  let activeConvId = conversationId;
  let convTitle = "";

  if (!activeConvId) {
    convTitle = generateTitleFromMessage(message || (attachments?.[0]?.name ? `File: ${attachments[0].name}` : "Chat"));
    const { data: newConv, error: newConvErr } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        title: convTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (newConvErr || !newConv) {
      throw new Error("Could not initialize conversation session");
    }
    activeConvId = newConv.id;
  } else {
    const { data: existingConv } = await supabase
      .from("ai_conversations")
      .select("title")
      .eq("id", activeConvId)
      .maybeSingle();
    convTitle = existingConv?.title || "Conversation";
  }

  // Save student's user message
  const now = new Date().toISOString();
  const { data: userMsg, error: userMsgErr } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: activeConvId,
      user_id: user.id,
      role: "user",
      content: message.trim() || "[Attached File]",
      metadata: { model: "gemini-2.5-flash", attachments: attachments || [] },
      created_at: now,
    })
    .select()
    .single();

  if (userMsgErr) {
    console.error("Error saving user message to database:", userMsgErr);
  }

  // Call the active Gemini function (ai-helper, used for quiz & tutor)
  const { data: aiHelperData, error: aiHelperErr } = await supabase.functions.invoke("ai-helper", {
    body: {
      prompt: message.trim(),
      type: "tutor",
      userId: user.id,
    },
  });

  if (aiHelperErr) {
    throw new Error(aiHelperErr.message || "Failed to receive response from Gemini AI");
  }

  const replyText =
    aiHelperData?.response ||
    "I received your question and processed it. Please ask any follow-up question!";

  // Save assistant message to database
  const { data: assistantMsg, error: asstMsgErr } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: activeConvId,
      user_id: user.id,
      role: "assistant",
      content: replyText,
      metadata: { model: "gemini-2.5-flash" },
      created_at: new Date(Date.now() + 10).toISOString(),
    })
    .select()
    .single();

  if (asstMsgErr) {
    console.error("Error saving assistant message:", asstMsgErr);
  }

  // Update conversation last_message_at
  await supabase
    .from("ai_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeConvId);

  return {
    conversationId: activeConvId,
    conversationTitle: convTitle,
    userMessage: userMsg || {
      id: `usr-${Date.now()}`,
      conversation_id: activeConvId,
      user_id: user.id,
      role: "user",
      content: message.trim(),
      created_at: now,
    },
    assistantMessage: assistantMsg || {
      id: `asst-${Date.now()}`,
      conversation_id: activeConvId,
      user_id: user.id,
      role: "assistant",
      content: replyText,
      created_at: now,
    },
  };
}

/**
 * Rename an existing conversation title.
 */
export async function renameConversation(conversationId: string, newTitle: string): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({
      title: newTitle.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error("Error renaming conversation:", error);
    throw error;
  }
  return true;
}

/**
 * Delete a specific conversation and all associated messages.
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    console.error("Error deleting conversation:", error);
    throw error;
  }
  return true;
}

/**
 * Clear all conversations for the authenticated user.
 */
export async function clearAllConversations(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Error clearing all conversations:", error);
    throw error;
  }
  return true;
}
