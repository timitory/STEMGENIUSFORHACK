export type AIChatRole = 'user' | 'assistant' | 'system';

export interface ChatAttachment {
  name: string;
  type: string; // mimeType e.g. "image/png", "application/pdf"
  size: number;
  dataUrl?: string; // base64 or preview url
  storageUrl?: string;
}

export interface AIChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: AIChatRole;
  content: string;
  attachments?: ChatAttachment[];
  metadata?: {
    model?: string;
    tokens_used?: number;
    error?: boolean;
    regenerated_from?: string;
    is_streaming?: boolean;
    attachments?: ChatAttachment[];
    [key: string]: any;
  } | null;
  created_at: string;
}

export interface AIChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  conversation_summary?: string | null;
  // Computed / joined fields
  messages?: AIChatMessage[];
  message_count?: number;
}

export interface SendMessageRequest {
  conversationId?: string; // If null, creates new conversation
  message: string;
  attachments?: ChatAttachment[];
  model?: string;
}

export interface SendMessageResponse {
  conversationId: string;
  conversationTitle: string;
  userMessage: AIChatMessage;
  assistantMessage: AIChatMessage;
}

