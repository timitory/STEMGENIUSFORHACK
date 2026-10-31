import { useState, useRef, useEffect } from "react";
import heroVoiceTutorImg from "@/assets/hero-voice-tutor.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mic, Square, Volume2, Loader2, Send, Trash2, Copy, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useFeatureAuth } from "@/hooks/useFeatureAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { handleError, withErrorHandling, validateInput } from "@/lib/errorHandler";

// Get browser speech recognition support safely
const getSpeechRecognition = () => {
  if (typeof window !== 'undefined') {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }
  return null;
};

// Chat history interface
interface ChatMessage {
  id: string;
  timestamp: number;
  question: string;
  response: string;
  language: string;
  voice: string;
}

// Language to voice mapping for Yarn GPT
const languageVoices: Record<string, { voice: string; label: string }[]> = {
  english: [
    { voice: "Emma", label: "Emma - Authoritative, deep" },
    { voice: "Zainab", label: "Zainab - Soothing, gentle" },
    { voice: "Jude", label: "Jude - Warm, confident" },
    { voice: "Mary", label: "Mary - Energetic, youthful" },
    { voice: "Adam", label: "Adam - Deep, Clear" },
  ],
  yoruba: [
    { voice: "Idera", label: "Idera - Melodic, gentle" },
    { voice: "Wura", label: "Wura - Young, sweet" },
    { voice: "Tayo", label: "Tayo - Upbeat, energetic" },
    { voice: "Remi", label: "Remi - Melodious, warm" },
  ],
  igbo: [
    { voice: "Chinenye", label: "Chinenye - Engaging, warm" },
    { voice: "Adaora", label: "Adaora - Warm, Engaging" },
    { voice: "Nonso", label: "Nonso - Bold, resonant" },
    { voice: "Femi", label: "Femi - Rich, reassuring" },
  ],
  hausa: [
    { voice: "Osagie", label: "Osagie - Smooth, calm" },
    { voice: "Regina", label: "Regina - Mature, warm" },
    { voice: "Umar", label: "Umar - Calm, smooth" },
  ],
};

const languageDisplayNames: Record<string, string> = {
  english: "English",
  yoruba: "Yoruba",
  igbo: "Igbo",
  hausa: "Hausa",
};

async function translateText(text: string, targetLang: string, userId?: string) {
  if (!text) return text;
  if (!targetLang || targetLang === "english") return text;

  const langName = languageDisplayNames[targetLang] || targetLang;

  // Ask your ai-helper to translate while preserving markdown, code blocks and math delimiters
  const prompt = `Translate the following content into ${langName}. Preserve all Markdown formatting, code blocks, and LaTeX/math delimiters (both $...$ and $$...$$). Do not add extra commentary or change the meaning; output only the translated content:\n\n${text}`;

  const { data: translateData, error: translateError } = await supabase.functions.invoke("ai-helper", {
    body: {
      prompt,
      type: "translator",
      userId,
    },
  });

  if (translateError) {
    console.error("Translation error:", translateError);
    // If translation fails, fall back to original text
    return text;
  }

  // ai-helper likely returns structure similar to the earlier call:
  const translated = (translateData && (translateData.response || translateData)) as string;
  return typeof translated === "string" ? translated : text;
}

// Add this helper function before the component
function splitTextIntoChunks(text: string, maxChars: number = 2000): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // Split by sentences/periods first, then by newlines, then by spaces
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    // If a single sentence is longer than maxChars, split it further by newlines or spaces
    if (currentChunk.length + sentence.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If the sentence itself is too long, split it by newlines or spaces
      if (sentence.length > maxChars) {
        const words = sentence.split(/\s+/);
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxChars) {
            if (wordChunk.length > 0) {
              chunks.push(wordChunk.trim());
              wordChunk = '';
            }
          }
          wordChunk += (wordChunk ? ' ' : '') + word;
        }
        if (wordChunk.length > 0) {
          chunks.push(wordChunk.trim());
        }
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export default function VoiceStemTutor() {
  const SpeechRecognition = getSpeechRecognition();
  const navigate = useNavigate();
  const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("voice_tutor");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [response, setResponse] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const [selectedVoice, setSelectedVoice] = useState("Zainab");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatMessage | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load chat history from database on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("voice_tutor_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (data && !error) {
        setChatHistory(data.map(s => ({
          id: s.id,
          timestamp: new Date(s.created_at).getTime(),
          question: s.question,
          response: s.response,
          language: s.language,
          voice: s.voice,
        })));
      }
    };
    loadHistory();
  }, [user]);

  const saveChatToHistory = async (question: string, aiResponse: string) => {
    // Only save if user is authenticated
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("voice_tutor_sessions")
        .insert({
          user_id: user.id,
          question,
          response: aiResponse,
          language: selectedLanguage,
          voice: selectedVoice,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newChat: ChatMessage = {
        id: data.id,
        timestamp: new Date(data.created_at).getTime(),
        question,
        response: aiResponse,
        language: selectedLanguage,
        voice: selectedVoice,
      };
      setChatHistory([newChat, ...chatHistory]);
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  const deleteChatFromHistory = async (id: string) => {
    try {
      await supabase.from("voice_tutor_sessions").delete().eq("id", id);
      setChatHistory(chatHistory.filter(chat => chat.id !== id));
      if (selectedChat?.id === id) {
        setSelectedChat(null);
      }
      toast.success("Chat deleted");
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    if (confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
      try {
        await supabase.from("voice_tutor_sessions").delete().eq("user_id", user.id);
        setChatHistory([]);
        setSelectedChat(null);
        toast.success("All history cleared");
      } catch (error) {
        console.error("Error clearing history:", error);
      }
    }
  };

  const exportChatAsText = (chat: ChatMessage) => {
    const text = `Question: ${chat.question}\n\nResponse:\n${chat.response}\n\nLanguage: ${languageDisplayNames[chat.language]}\nVoice: ${chat.voice}\nDate: ${new Date(chat.timestamp).toLocaleString()}`;
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", `stem-tutor-${chat.id}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Chat exported!");
  };

  const startRecording = () => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript("");
        toast.success("Recording started - speak now");
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          toast.error("No speech detected. Please try again.");
        } else if (event.error === 'audio-capture') {
          toast.error("No microphone found. Please check your settings.");
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please allow microphone access.");
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (finalTranscript.trim()) {
          processQuestion(finalTranscript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      toast.error("Failed to start speech recognition");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const processQuestion = async (question: string) => {
    const questionError = validateInput(question, "Question");
    if (questionError) {
      toast.error(questionError);
      return;
    }

    // Check auth before saving - allow preview use but require auth to save
    const authRequired = checkAuthRequired("Log in to save your chat history and track your progress.");
    if (authRequired) {
      return;
    }

    setIsProcessing(true);
    setResponse("");
    setAudioUrl(null);

    const result = await withErrorHandling(async () => {
      // 1) Get AI response (original, likely English)
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-helper", {
        body: {
          prompt: question,
          type: "tutor",
          userId: user?.id,
        },
      });

      if (aiError) throw aiError;

      // aiData.response contains the original AI text
      const originalAiText = (aiData && (aiData.response || aiData)) as string;

      // 2) Translate the AI response into the selected language (if needed)
      const translatedText = await translateText(originalAiText, selectedLanguage, user?.id);

      // 3) Format the translated text for display (keeps existing formatting rules)
      const displayText = formatResponse(translatedText);
      setResponse(displayText);

      // 4) Split the translated text into chunks (max 2000 chars each)
      const textChunks = splitTextIntoChunks(translatedText, 2000);

      // 5) Send each chunk to text-to-speech and collect audio
      const audioBuffers: Uint8Array[] = [];

      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`Processing audio chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke("text-to-speech", {
          body: {
            text: chunk,
            voice: selectedVoice,
          },
        });

        if (ttsError) {
          console.error(`TTS error for chunk ${i + 1}:`, ttsError);
          // Continue with next chunk instead of stopping
          continue;
        }

        if (ttsData?.audioContent) {
          // Decode base64 audio content
          const binaryString = atob(ttsData.audioContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          audioBuffers.push(bytes);
        }
      }

      // 6) Combine all audio chunks into a single blob
      if (audioBuffers.length > 0) {
        // Calculate total size
        const totalSize = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
        const combinedArray = new Uint8Array(totalSize);

        // Concatenate all buffers
        let offset = 0;
        for (const buffer of audioBuffers) {
          combinedArray.set(buffer, offset);
          offset += buffer.length;
        }

        // Create blob and URL
        const audioBlob = new Blob([combinedArray], { type: "audio/mp3" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        toast.success(`Response generated successfully! (${textChunks.length} audio segment${textChunks.length > 1 ? 's' : ''})`);
      } else {
        toast.error("No audio was generated");
      }

      // Save to history
      saveChatToHistory(question, displayText);

      // Clear text input if it was used
      setTextInput("");
    }, "voice tutor processing");

    setIsProcessing(false);
  };

  const formatResponse = (text: string) => {
    // Remove asterisks used for markdown bold/italic
    let formatted = text.replace(/\*\*/g, '');
    formatted = formatted.replace(/\*/g, '');
    
    // Convert inline math notation $...$ to LaTeX $$...$$
    formatted = formatted.replace(/\$([^$]+)\$/g, '$$$$1$$');
    
    return formatted;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle language change - update voice to first available for that language
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    const voices = languageVoices[language];
    if (voices && voices.length > 0) {
      setSelectedVoice(voices[0].voice);
    }
  };

  const availableVoices = languageVoices[selectedLanguage] || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Voice STEM Tutor</h1>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Hide" : "Show"} History ({chatHistory.length})
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-4">
        <PageHeroBanner image={heroVoiceTutorImg} title="Voice STEM Tutor" subtitle="Ask questions and receive voice explanations in multiple languages" badge="Voice AI" />
      </div>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Preview Mode Banner */}
          {!user && isPreviewAvailable && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                You're trying this feature as a preview. You can use it once without logging in. <strong>Your progress won't be saved</strong> unless you sign in.
              </AlertDescription>
            </Alert>
          )}

          {/* Language & Voice Selection */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Response Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Response Language
                  </label>
                  <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="yoruba">Yoruba</SelectItem>
                      <SelectItem value="igbo">Igbo</SelectItem>
                      <SelectItem value="hausa">Hausa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Voice
                  </label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVoices.map((v) => (
                        <SelectItem key={v.voice} value={v.voice}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!SpeechRecognition && (
                <p className="text-sm text-destructive">
                  Speech recognition is not supported in your browser. Please use Chrome or Edge.
                </p>
              )}
            </div>
          </Card>

          {/* Voice Input */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Ask Your Question</h2>
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className={`w-32 h-32 rounded-full ${isRecording ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing || !SpeechRecognition}
                >
                  {isRecording ? (
                    <Square className="w-12 h-12" />
                  ) : (
                    <Mic className="w-12 h-12" />
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {isRecording ? "Recording... Click to stop" : "Click to start recording"}
                </p>
              </div>
            </div>
          </Card>

          {/* Text Input */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Or Type Your Question</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isProcessing) {
                      processQuestion(textInput);
                    }
                  }}
                  placeholder="Type your question here..."
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  onClick={() => processQuestion(textInput)}
                  disabled={isProcessing || !textInput.trim()}
                  className="px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Transcript */}
          {transcript && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Your Question</h2>
              <p className="text-foreground">{transcript}</p>
            </Card>
          )}

          {/* Response */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">AI Response</h2>
            
            {isProcessing ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Processing your question...</p>
                </div>
              </div>
            ) : response ? (
              <>
                <div className="prose prose-sm max-w-none bg-muted p-4 rounded-lg mb-4 text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {response}
                  </ReactMarkdown>
                </div>

                {audioUrl && (
                  <div className="flex items-center gap-2">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={toggleAudio}
                      className="flex-1"
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      {isPlaying ? "Pause Audio" : "Play Audio Response"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Your AI tutor's response will appear here
              </div>
            )}
          </Card>
        </div>

        {/* Chat History Sidebar */}
        {showHistory && (
          <div className="lg:col-span-1">
            <Card className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Chat History</h2>
                  {chatHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllHistory}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {chatHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chat history yet</p>
                ) : (
                  <div className="space-y-2">
                    {chatHistory.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedChat(selectedChat?.id === chat.id ? null : chat)}
                        className="w-full text-left p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {chat.question.substring(0, 40)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(chat.timestamp).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Selected Chat Details */}
            {selectedChat && (
              <Card className="p-6 mt-4 max-h-[calc(100vh-500px)] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Question</h3>
                    <p className="text-sm text-foreground">{selectedChat.question}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Response</h3>
                    <div className="prose prose-sm max-w-none bg-muted p-3 rounded-lg text-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {selectedChat.response}
                      </ReactMarkdown>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Language: {languageDisplayNames[selectedChat.language]}</p>
                    <p>Voice: {selectedChat.voice}</p>
                    <p>Date: {new Date(selectedChat.timestamp).toLocaleString()}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`Q: ${selectedChat.question}\n\nA: ${selectedChat.response}`);
                        toast.success("Copied to clipboard!");
                      }}
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportChatAsText(selectedChat)}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteChatFromHistory(selectedChat.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
