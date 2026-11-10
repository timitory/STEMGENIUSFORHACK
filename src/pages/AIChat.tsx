import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Brain, Sparkles, Send, Plus, Trash2, Edit2, Copy, Check,
  RotateCcw, AlertCircle, Loader2, MessageSquare, Search,
  PanelLeftClose, PanelLeft, ArrowDown, ChevronRight, BookOpen,
  GraduationCap, HelpCircle, FileText, Zap, Compass, Calculator, User,
  Paperclip, Image as ImageIcon, X, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  fetchUserConversations,
  fetchConversationMessages,
  sendChatMessage,
  renameConversation,
  deleteConversation,
  clearAllConversations,
} from "@/lib/aiChatService";
import { AIChatConversation, AIChatMessage, ChatAttachment } from "@/types/aiChat";
import { DiagramViewer } from "@/components/chat/DiagramViewer";

export default function AIChat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Conversations & Messages
  const [conversations, setConversations] = useState<AIChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Input & Sending state
  const [inputMessage, setInputMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Mobile Drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dialogs
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [targetConvToRename, setTargetConvToRename] = useState<AIChatConversation | null>(null);
  const [newTitleInput, setNewTitleInput] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetConvToDelete, setTargetConvToDelete] = useState<AIChatConversation | null>(null);

  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 25MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl: reader.result as string,
          },
        ]);
        toast.success(`Attached ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // Suggested Starter Prompts
  const suggestionCards = [
    {
      title: "Explain a difficult concept",
      prompt: "Explain how photosynthesis converts light energy into chemical energy step by step with chemical equations.",
      icon: <BookOpen className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: "Prepare for examinations",
      prompt: "Give me 5 practice multiple-choice questions on projectile motion for the JAMB / WAEC examination with detailed solutions.",
      icon: <GraduationCap className="w-4 h-4 text-primary" />,
    },
    {
      title: "Solve mathematics step-by-step",
      prompt: "How do I solve quadratic equations using the quadratic formula? Please provide an example with complex roots.",
      icon: <Calculator className="w-4 h-4 text-accent" />,
    },
    {
      title: "Summarise lecture notes",
      prompt: "Can you help me summarize my STEM notes and extract key definitions, formulas, and high-yield examination takeaways?",
      icon: <FileText className="w-4 h-4 text-sky-500" />,
    },
  ];

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadUserProfile(session.user.id);
      loadConversations();
    });
  }, [navigate]);

  const loadUserProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(data);
    setIsLoadingUser(false);
  };

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const convs = await fetchUserConversations();
      setConversations(convs);

      // If URL has a conversationId, select it; otherwise default to newest if available
      if (conversationId) {
        setActiveConversationId(conversationId);
        loadMessages(conversationId);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      toast.error("Could not load previous chats");
    } finally {
      setLoadingConversations(false);
    }
  };

  // When active conversation changes, load its messages
  const loadMessages = async (convId: string) => {
    try {
      setLoadingMessages(true);
      const msgs = await fetchConversationMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
      toast.error("Could not load messages for this conversation");
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    navigate(`/ai-chat/${id}`);
    loadMessages(id);
    setSidebarOpen(false); // Close mobile drawer
  };

  const handleStartNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputMessage("");
    navigate("/ai-chat");
    setSidebarOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, isSending]);

  // Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    const currentAttachments = [...attachments];

    if ((!text && currentAttachments.length === 0) || isSending) return;

    setInputMessage("");
    setAttachments([]);
    setIsSending(true);

    // Optimistic user message
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const optimisticUserMsg: AIChatMessage = {
      id: tempUserMsgId,
      conversation_id: activeConversationId || "temp",
      user_id: user?.id || "",
      role: "user",
      content: text || (currentAttachments.length > 0 ? `[Sent ${currentAttachments.length} file(s)]` : ""),
      attachments: currentAttachments,
      metadata: { attachments: currentAttachments },
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const response = await sendChatMessage(
        text,
        activeConversationId || undefined,
        currentAttachments
      );

      // If this was a new conversation, update URL and state
      if (!activeConversationId) {
        setActiveConversationId(response.conversationId);
        navigate(`/ai-chat/${response.conversationId}`, { replace: true });
      }

      // Replace optimistic message and append assistant reply
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsgId),
        response.userMessage,
        response.assistantMessage,
      ]);

      // Refresh conversations list to update title and last_message_at
      const updatedConvs = await fetchUserConversations();
      setConversations(updatedConvs);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error(err.message || "Failed to receive response from STEM Genius AI");
      // Add error tag to message for retry
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsgId),
        {
          ...optimisticUserMsg,
          metadata: { error: true, attachments: currentAttachments },
        },
      ]);
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Handle Enter to Send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy message text
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Regenerate last response
  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content);
    }
  };

  // Open Rename Dialog
  const openRenameModal = (conv: AIChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetConvToRename(conv);
    setNewTitleInput(conv.title);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!targetConvToRename || !newTitleInput.trim()) return;
    try {
      await renameConversation(targetConvToRename.id, newTitleInput.trim());
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvToRename.id ? { ...c, title: newTitleInput.trim() } : c
        )
      );
      toast.success("Conversation renamed");
      setRenameDialogOpen(false);
    } catch {
      toast.error("Failed to rename conversation");
    }
  };

  // Open Delete Dialog
  const openDeleteModal = (conv: AIChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetConvToDelete(conv);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetConvToDelete) return;
    try {
      await deleteConversation(targetConvToDelete.id);
      setConversations((prev) => prev.filter((c) => c.id !== targetConvToDelete.id));

      if (activeConversationId === targetConvToDelete.id) {
        handleStartNewChat();
      }

      toast.success("Conversation deleted");
      setDeleteDialogOpen(false);
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  // Clear all chats
  const handleConfirmClearAll = async () => {
    try {
      await clearAllConversations();
      setConversations([]);
      handleStartNewChat();
      toast.success("Conversation history cleared");
      setClearAllDialogOpen(false);
    } catch {
      toast.error("Failed to clear chat history");
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* App Header */}
      <Header
        userName={profile?.name || "Student"}
        isPremium={profile?.is_premium || false}
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate("/");
        }}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* ── LEFT SIDEBAR (Desktop + Mobile Drawer) ───────────────────────── */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-72 sm:w-80 bg-card border-r border-border/60 flex flex-col transition-transform duration-300 ease-in-out
            lg:static lg:translate-x-0
            ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Top New Chat & Close Buttons */}
          <div className="p-3.5 border-b border-border/50 flex items-center justify-between gap-2">
            <Button
              onClick={handleStartNewChat}
              className="flex-1 justify-start gap-2 h-10 text-xs font-semibold shadow-sm"
              variant="default"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="w-5 h-5" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary/40 border-border/40"
              />
            </div>
          </div>

          {/* Conversation History List */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Recent Chats</span>
              <span className="text-[10px] text-primary font-mono">{filteredConversations.length}</span>
            </div>

            {loadingConversations ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading chats...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {searchQuery ? "No matching conversations" : "No past conversations yet. Start asking questions!"}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`
                      group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all
                      ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border border-primary/25 shadow-sm"
                          : "text-foreground hover:bg-secondary/60 border border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="truncate">{conv.title}</span>
                    </div>

                    {/* Quick action buttons on hover / active */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => openRenameModal(conv, e)}
                        className="p-1 hover:text-primary rounded"
                        title="Rename Chat"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => openDeleteModal(conv, e)}
                        className="p-1 hover:text-destructive rounded"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Settings / Clear All */}
          {conversations.length > 0 && (
            <div className="p-3 border-t border-border/50 bg-card/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClearAllDialogOpen(true)}
                className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Conversations</span>
              </Button>
            </div>
          )}
        </aside>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── MAIN CHAT AREA ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col bg-background/50 h-full relative overflow-hidden">
          {/* Top Assistant Header */}
          <div className="h-14 border-b border-border/40 px-4 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 text-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="w-4 h-4" />
              </Button>

              <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm shrink-0">
                <Brain className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                    {activeConv?.title || "STEM Genius AI"}
                  </h2>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 px-1.5 py-0 h-4">
                    Gemini 2.5
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground hidden sm:block">
                  Your persistent, context-aware STEM tutor & revision partner
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartNewChat}
                className="text-xs h-8 gap-1.5 hidden sm:inline-flex"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Topic</span>
              </Button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-6">
            {messages.length === 0 ? (
              // Empty State: Welcome Hero & Clickable Suggestions
              <div className="max-w-2xl mx-auto py-8 sm:py-12 space-y-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center mx-auto shadow-xl shadow-primary/10 text-primary">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    Hello! I&apos;m <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">STEM Genius AI</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    Your interactive learning companion. Ask me questions, explore difficult concepts, get step-by-step solutions, and continue learning through conversation.
                  </p>
                </div>

                {/* Suggestions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                  {suggestionCards.map((card, i) => (
                    <Card
                      key={i}
                      onClick={() => handleSendMessage(card.prompt)}
                      className="p-4 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        {card.icon}
                        <span>{card.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed group-hover:text-foreground/90">
                        &quot;{card.prompt}&quot;
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              // Message History List
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isCopied = copiedMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm mt-1">
                          <Brain className="w-4 h-4" />
                        </div>
                      )}

                      <div className={`space-y-1.5 max-w-[88%] sm:max-w-[80%]`}>
                        <div
                          className={`
                            p-4 rounded-2xl text-xs sm:text-sm leading-relaxed
                            ${
                              isUser
                                ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md"
                                : "bg-card border border-border/70 rounded-tl-sm text-foreground shadow-sm"
                            }
                          `}
                        >
                          {/* Render user attachments if present */}
                          {isUser && (msg.attachments || msg.metadata?.attachments) && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(msg.attachments || msg.metadata?.attachments).map((att: any, i: number) =>
                                att.type?.startsWith("image/") && att.dataUrl ? (
                                  <a
                                    key={i}
                                    href={att.dataUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-xl overflow-hidden border border-white/30 hover:scale-105 transition-transform shadow-sm"
                                  >
                                    <img src={att.dataUrl} alt={att.name} className="w-24 h-24 object-cover" />
                                  </a>
                                ) : (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-white/20 text-xs text-white"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                                    {att.size && (
                                      <span className="text-[10px] opacity-75 font-mono">
                                        ({(att.size / 1024).toFixed(0)}KB)
                                      </span>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-3 rounded-xl border border-border/70 shadow-sm bg-card/60">
                                      <table className="w-full text-xs sm:text-sm text-left border-collapse" {...props} />
                                    </div>
                                  ),
                                  thead: ({ node, ...props }) => (
                                    <thead className="bg-secondary/70 border-b border-border/70 text-foreground font-semibold" {...props} />
                                  ),
                                  th: ({ node, ...props }) => (
                                    <th className="py-2.5 px-3 text-xs font-bold tracking-wide uppercase border-r last:border-r-0 border-border/50 text-foreground" {...props} />
                                  ),
                                  td: ({ node, ...props }) => (
                                    <td className="py-2 px-3 border-b border-r last:border-r-0 border-border/40 text-foreground/90" {...props} />
                                  ),
                                  img: ({ node, ...props }) => (
                                    <div className="my-3 rounded-xl overflow-hidden border border-border/60 shadow-md bg-secondary/20">
                                      <img className="max-w-full h-auto object-cover rounded-xl mx-auto max-h-96" loading="lazy" {...props} />
                                      {props.alt && (
                                        <p className="text-[11px] text-muted-foreground text-center py-1.5 px-3 bg-secondary/40 border-t border-border/40">
                                          {props.alt}
                                        </p>
                                      )}
                                    </div>
                                  ),
                                  code: ({ node, inline, className, children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(className || "");
                                    const lang = match ? match[1] : "";
                                    const codeString = String(children).replace(/\n$/, "");

                                    if (
                                      lang === "mermaid" ||
                                      codeString.includes("graph TD") ||
                                      codeString.includes("graph LR") ||
                                      codeString.includes("flowchart TD") ||
                                      codeString.includes("flowchart LR") ||
                                      codeString.includes("mindmap")
                                    ) {
                                      return <DiagramViewer code={codeString} />;
                                    }

                                    if (!inline && lang) {
                                      return (
                                        <div className="my-2 rounded-xl overflow-hidden border border-border/60 bg-secondary/30">
                                          <div className="px-3 py-1 bg-secondary/60 text-[10px] font-mono font-bold text-muted-foreground border-b border-border/40 uppercase">
                                            {lang}
                                          </div>
                                          <pre className="p-3 text-xs font-mono overflow-x-auto">
                                            <code className={className} {...props}>
                                              {children}
                                            </code>
                                          </pre>
                                        </div>
                                      );
                                    }

                                    return (
                                      <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[11px] text-primary" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* Assistant Message Actions */}
                        {!isUser && (
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                            <span>STEM Genius AI</span>
                            <span>•</span>
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                              title="Copy text"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground shrink-0 shadow-sm mt-1">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing / Generating Indicator */}
                {isSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm mt-1 animate-pulse">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-card border border-border/60 rounded-tl-sm flex items-center gap-2 text-xs text-muted-foreground shadow-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>STEM Genius AI is thinking and formulating explanation...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── BOTTOM INPUT BAR ────────────────────────────────────────────── */}
          <div className="p-3 sm:p-4 border-t border-border/40 bg-card/60 backdrop-blur shrink-0 z-10">
            <div className="max-w-3xl mx-auto relative">
              {/* File Attachment Strip */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 mb-2 bg-secondary/60 rounded-xl border border-border/60 animate-in fade-in">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="relative group flex items-center gap-2 p-1.5 rounded-lg bg-background border border-border/80 shadow-xs"
                    >
                      {att.type.startsWith("image/") && att.dataUrl ? (
                        <img src={att.dataUrl} alt={att.name} className="w-9 h-9 rounded-md object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex flex-col pr-1">
                        <span className="text-[11px] max-w-[120px] sm:max-w-[160px] truncate text-foreground font-semibold">
                          {att.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                className="hidden"
                onChange={(e) => {
                  handleFileSelect(e.target.files);
                  if (e.target) e.target.value = "";
                }}
              />

              <div className="relative rounded-2xl border border-border/70 bg-background/90 shadow-lg focus-within:border-primary/60 transition-colors p-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask any STEM question, attach problem images, or explore notes..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent text-xs sm:text-sm p-1.5 focus-visible:ring-0 shadow-none max-h-36 placeholder:text-muted-foreground/70"
                />

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
                      title="Attach image or document (PDF, DOCX, TXT)"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-medium hidden sm:inline">Attach</span>
                    </Button>
                    <span className="text-[10px] text-muted-foreground px-1 hidden md:block">
                      Supports images, PDFs, notes (up to 25MB)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {messages.length > 0 && !isSending && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRegenerate}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        title="Regenerate last response"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Regenerate</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      disabled={(!inputMessage.trim() && attachments.length === 0) || isSending}
                      onClick={() => handleSendMessage()}
                      className="h-8 px-4 rounded-xl gap-1.5 text-xs font-semibold shadow-sm"
                    >
                      {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── DIALOG: RENAME CONVERSATION ──────────────────────────────────── */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>
              Enter a descriptive title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              placeholder="e.g. Organic Chemistry Carbon Bonds"
              className="text-xs sm:text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmRename}>
              Save Title
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: DELETE CONVERSATION ──────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Conversation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{targetConvToDelete?.title}&quot;? All messages in this conversation will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Delete Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CLEAR ALL CHATS ──────────────────────────────────────── */}
      <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Clear Entire Chat History
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all your conversation history and messages with STEM Genius AI. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setClearAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmClearAll}>
              Yes, Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

