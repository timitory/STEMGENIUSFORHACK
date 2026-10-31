import { useState, useEffect, ChangeEvent, useRef } from "react";
import heroChallengeImg from "@/assets/hero-challenge.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft, Trophy, Zap, Clock, CheckCircle2, XCircle, Star, Crown, Flame,
  History, Share2, Plus, Gift, DollarSign, Copy, Users, Sparkles, BookOpen, Eye, RotateCcw,
  Layers, ChevronLeft, ChevronRight, Upload, Trash2, RotateCw, CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { notifyQuizCompletion, notifyQuizChallenge, checkAndNotifyAchievements } from "@/lib/notifications";
import { handleError, withErrorHandling, validateInput } from "@/lib/errorHandler";
import { requestQueue, rateLimiter, fileSizeValidator, requestDeduplicator } from "@/lib/requestQueue";
import SUBJECTED from "./Subjects";

interface Question {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

interface QuizAttempt {
  id: string;
  quiz_id: string | null;
  score: number;
  total_points: number;
  correct_answers: number;
  total_questions: number;
  subject: string;
  topic: string | null;
  completed_at: string;
  answers?: (number | null)[];
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  topic: string | null;
  difficulty: string;
  quiz_code: string;
  cash_prize: number;
  gift_description: string | null;
  total_questions: number;
  creator_id: string;
  is_ai_generated?: boolean;
  is_timed?: boolean;
  total_time?: number;
  time_per_question?: number | null;
}

interface Flashcard {
  id?: string;
  front: string;
  back: string;
  order_index: number;
}

interface FlashcardDeck {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  source_type: string;
  total_cards: number;
  created_at: string;
}
const sortedSubjects = [...SUBJECTED]
  .sort((a, b) =>
    a.value.toLowerCase().localeCompare(b.value.toLowerCase())
  )
  .map(subject => ({
    ...subject,
    topics: [...subject.topics].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    )
  }));
const SUBJECTS = sortedSubjects;

export default function STEMChallengeArena() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get('code');
  
  const [user, setUser] = useState<any>(null);
  const [gameState, setGameState] = useState<"menu" | "setup" | "playing" | "results" | "create" | "history" | "join" | "review" | "flashcards" | "flashcard-view" | "flashcard-decks">("menu");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [userSubmittedAnswers, setUserSubmittedAnswers] = useState<(number | null)[]>([]);
  const [timerActive, setTimerActive] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Setup state - Legacy
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  
  // Setup state - Multi-subject/topic
  const [multiSetup, setMultiSetup] = useState(false);
  interface SubjectTopicSelection {
    subject: string;
    topics: string[];
    customTopic?: string;
    questionCount: number;
  }
  const [selectedSubjectsWithTopics, setSelectedSubjectsWithTopics] = useState<SubjectTopicSelection[]>([]);
  const [setupDifficulty, setSetupDifficulty] = useState("medium");

  // Setup state - Document-based quiz generation
  const [documentSetup, setDocumentSetup] = useState(false);
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [quizDocText, setQuizDocText] = useState("");
  const [documentSource, setDocumentSource] = useState<"upload" | "paste">("upload");

  // Custom quiz time settings - AI Quiz
  const [aiQuizTotalTimeMinutes, setAiQuizTotalTimeMinutes] = useState('5');
  const [customNumberOfQuestions, setCustomNumberOfQuestions] = useState(10);
  
  // Deferred feedback mode - new quiz flow
  const [timerMode, setTimerMode] = useState<'timed' | 'untimed'>('timed');
  const [submittedQuiz, setSubmittedQuiz] = useState(false);
  
  // History state
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  
  // Create quiz state
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [cashPrize, setCashPrize] = useState(0);
  const [giftDescription, setGiftDescription] = useState("");
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);
  const [currentManualQuestion, setCurrentManualQuestion] = useState<Question>({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    points: 10
  });
  const [isParsingQuestions, setIsParsingQuestions] = useState(false);
  
  // Timing for custom quizzes
  const [quizIsTimed, setQuizIsTimed] = useState(true);
  const [quizTotalTimeAmount, setQuizTotalTimeAmount] = useState('5');
  const [quizTotalTimeUnit, setQuizTotalTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');
  
  // Join quiz state
  const [quizCode, setQuizCode] = useState(joinCode || "");
  const [joinedQuiz, setJoinedQuiz] = useState<Quiz | null>(null);
  
  // Current quiz tracking
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  // Review state
  const [reviewingAttempt, setReviewingAttempt] = useState<QuizAttempt | null>(null);
  const [reviewQuiz, setReviewQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showQuizCode, setShowQuizCode] = useState(false);
  const [generatedQuizCode, setGeneratedQuizCode] = useState<string | null>(null);

  // Flashcard state
  const [flashcardSubject, setFlashcardSubject] = useState("");
  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardCount, setFlashcardCount] = useState(15);
  const [flashcardFile, setFlashcardFile] = useState<File | null>(null);
  const [flashcardDocText, setFlashcardDocText] = useState("");
  const [flashcardSource, setFlashcardSource] = useState<"topic" | "document">("topic");
  const [generatedFlashcards, setGeneratedFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [viewingDeckCards, setViewingDeckCards] = useState<Flashcard[]>([]);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

  // Refs for upload tracking & deduplication
  const pendingUploadsRef = useRef<Set<string>>(new Set());
  const lastDocumentUploadRef = useRef<{ file: File; timestamp: number } | null>(null);

  useEffect(() => {
    checkAuth();
    if (joinCode) {
      setGameState("join");
      setQuizCode(joinCode);
    }
  }, [joinCode]);

  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchFlashcardDecks();
    }
  }, [user]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === "playing" && timerActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timerActive, timeLeft]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setQuizHistory(data as unknown as QuizAttempt[]);
    }
  };

  const fetchFlashcardDecks = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("flashcard_decks" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setFlashcardDecks(data as unknown as FlashcardDeck[]);
    }
  };

  const generateFlashcards = async () => {
    // Check if user is authenticated
    if (!user) {
      toast.error("Please sign in to generate flashcards");
      return;
    }

    // Check if user is rate limited
    if (!rateLimiter.isAllowed(user.id)) {
      const resetTime = rateLimiter.getResetTime(user.id);
      toast.error(`Too many requests. Please wait ${Math.ceil(resetTime / 1000)}s`);
      return;
    }

    if (flashcardSource === "topic" && !flashcardSubject) {
      toast.error("Please select a subject");
      return;
    }
    if (flashcardSource === "document" && !flashcardDocText.trim() && !flashcardFile) {
      toast.error("Please paste document text or upload a file");
      return;
    }

    // Prevent duplicate requests
    let flashcardHash = "";
    if (flashcardSource === "topic") {
      flashcardHash = `flashcard_topic_${flashcardSubject}_${flashcardTopic}_${flashcardCount}`;
    } else if (flashcardSource === "document" && flashcardFile) {
      flashcardHash = `flashcard_file_${flashcardFile.name}_${flashcardFile.size}_${flashcardCount}`;
    } else {
      flashcardHash = `flashcard_text_${flashcardDocText.length}_${flashcardCount}`;
    }

    const dedupeResult = requestDeduplicator.checkAndStore(flashcardHash);
    if (dedupeResult.isDuplicate) {
      toast.warning("This request was just submitted. Please wait a moment...");
      return;
    }

    setIsGeneratingFlashcards(true);
    try {
      let body: any = {
        subject: flashcardSubject,
        topic: flashcardTopic,
        numberOfCards: flashcardCount
      };

      if (flashcardSource === "document" && flashcardFile) {
        // Validate file size
        const sizeValidation = fileSizeValidator.validate(flashcardFile);
        if (!sizeValidation.valid) {
          throw new Error(sizeValidation.error);
        }

        const formData = new FormData();
        formData.append('file', flashcardFile);
        formData.append('subject', flashcardSubject || '');
        formData.append('topic', flashcardTopic || '');
        formData.append('numberOfCards', flashcardCount.toString());
        body = formData;
      } else if (flashcardSource === "document") {
        body.documentText = flashcardDocText;
      }

      // Queue the flashcard generation request
      const requestId = `flashcard_${user.id}_${flashcardHash}`;
      
      await requestQueue.enqueue(requestId, async () => {
        const { data, error } = await supabase.functions.invoke('generate-flashcards', {
          body
        });
        if (error) {
          console.error("Flashcard generation error:", error);
          throw error;
        }
        if (data?.flashcards && Array.isArray(data.flashcards)) {
          const cards: Flashcard[] = data.flashcards.map((f: any, idx: number) => ({
            front: f.front, 
            back: f.back, 
            order_index: idx
          }));
          setGeneratedFlashcards(cards);
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setGameState("flashcard-view");
          await saveFlashcardDeck(cards);
        } else {
          console.error("Invalid response format:", data);
          throw new Error("Invalid response format from flashcard generation");
        }
      });
    } catch (error: any) {
      console.error("Flashcard generation error:", error);
      handleError(error, "flashcard generation");
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const saveFlashcardDeck = async (cards: Flashcard[]) => {
    if (!user) return;

    const result = await withErrorHandling(async () => {
      const title = flashcardSource === "document"
        ? `Document Flashcards (${cards.length} cards)`
        : `${flashcardSubject}${flashcardTopic ? ` - ${flashcardTopic}` : ""} Flashcards`;

      const { data: deck, error: deckError } = await supabase
        .from("flashcard_decks" as any)
        .insert({ user_id: user.id, title, subject: flashcardSubject || "Document", topic: flashcardTopic || null, source_type: flashcardSource, total_cards: cards.length })
        .select().single();

      if (deckError) throw deckError;

      const cardsToInsert = cards.map((c, idx) => ({ deck_id: (deck as any).id, front: c.front, back: c.back, order_index: idx }));
      const { error: cardsError } = await supabase.from("flashcards" as any).insert(cardsToInsert);

      if (cardsError) throw cardsError;

      toast.success("Flashcards saved!");
      fetchFlashcardDecks();
    }, "saving flashcard deck");
  };

  const viewDeck = async (deckId: string) => {
    const { data, error } = await supabase.from("flashcards" as any).select("*").eq("deck_id", deckId).order("order_index");
    if (!error && data) {
      setGeneratedFlashcards(data as unknown as Flashcard[]);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setGameState("flashcard-view");
    }
  };

  const deleteDeck = async (deckId: string) => {
    const { error } = await supabase.from("flashcard_decks" as any).delete().eq("id", deckId);
    if (!error) { toast.success("Deck deleted"); fetchFlashcardDecks(); }
  };

  const handleFlashcardFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const sizeValidation = fileSizeValidator.validate(file);
    if (!sizeValidation.valid) {
      toast.error(sizeValidation.error);
      return;
    }

    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a supported file type: TXT, PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, GIF, WEBP");
      return;
    }
    
    // Prevent duplicate uploads of same file
    if (lastDocumentUploadRef.current?.file.name === file.name && 
        lastDocumentUploadRef.current?.file.size === file.size &&
        Date.now() - lastDocumentUploadRef.current.timestamp < 2000) {
      toast.warning("This file was just uploaded. Please wait a moment.");
      return;
    }

    setFlashcardFile(file);
    lastDocumentUploadRef.current = { file, timestamp: Date.now() };
    toast.success("File uploaded successfully!");
  };

  const generateQuestions = async () => {
    const subjectError = validateInput(selectedSubject, "Subject");
    if (subjectError) {
      toast.error(subjectError);
      return;
    }

    setIsLoading(true);
    const result = await withErrorHandling(async () => {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          subject: selectedSubject,
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          numberOfQuestions: customNumberOfQuestions
        }
      });

      if (error) throw error;

      if (data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        startGame(data.questions);
      } else {
        throw new Error("Invalid response format");
      }
    }, "quiz generation");

    setIsLoading(false);
  };

  const addSubjectToMultiSetup = (subject: string) => {
    if (!selectedSubjectsWithTopics.find(s => s.subject === subject)) {
      setSelectedSubjectsWithTopics([...selectedSubjectsWithTopics, {
        subject,
        topics: [],
        questionCount: 5
      }]);
    }
  };

  const removeSubjectFromMultiSetup = (subject: string) => {
    setSelectedSubjectsWithTopics(selectedSubjectsWithTopics.filter(s => s.subject !== subject));
  };

  const toggleTopicForSubject = (subject: string, topic: string) => {
    setSelectedSubjectsWithTopics(prev => prev.map(s => {
      if (s.subject === subject) {
        const hasTopics = s.topics.includes(topic);
        return {
          ...s,
          topics: hasTopics ? s.topics.filter(t => t !== topic) : [...s.topics, topic]
        };
      }
      return s;
    }));
  };

  const updateSubjectQuestionCount = (subject: string, count: number) => {
    setSelectedSubjectsWithTopics(prev => prev.map(s =>
      s.subject === subject ? { ...s, questionCount: count } : s
    ));
  };

  const updateSubjectCustomTopic = (subject: string, customTopic: string) => {
    setSelectedSubjectsWithTopics(prev => prev.map(s =>
      s.subject === subject ? { ...s, customTopic } : s
    ));
  };

  const generateMultiSubjectQuestions = async () => {
    if (selectedSubjectsWithTopics.length === 0) {
      toast.error("Please select at least one subject");
      return;
    }
    setIsLoading(true);
    await withErrorHandling(async () => {
      const allQuestions: Question[] = [];
      for (const selection of selectedSubjectsWithTopics) {
        const topics = selection.topics.length > 0 ? selection.topics : [selection.customTopic || ""];
        const topicsStr = topics.filter(t => t).join(", ");
        const { data, error } = await supabase.functions.invoke('generate-quiz', {
          body: {
            subject: selection.subject,
            topic: topicsStr,
            difficulty: setupDifficulty,
            numberOfQuestions: selection.questionCount
          }
        });
        if (error) throw error;
        if (data.questions && Array.isArray(data.questions)) {
          allQuestions.push(...data.questions);
        }
      }
      if (allQuestions.length === 0) {
        throw new Error("No questions were generated");
      }
      setQuestions(allQuestions);
      setSelectedSubject(selectedSubjectsWithTopics.map(s => s.subject).join(", "));
      setSelectedTopic(selectedSubjectsWithTopics.map(s => s.customTopic || s.topics.join(", ") || "Mixed").join(" | "));
      startGame(allQuestions);
    }, "multi-subject quiz generation");
    setIsLoading(false);
  };

  const generateDocumentQuestions = async () => {
    // Check if user is rate limited
    if (user && !rateLimiter.isAllowed(user.id)) {
      const resetTime = rateLimiter.getResetTime(user.id);
      toast.error(`Too many requests. Please wait ${Math.ceil(resetTime / 1000)}s`);
      return;
    }

    // Prevent duplicate concurrent uploads
    let documentHash = "";
    if (documentSource === "upload" && quizFile) {
      documentHash = `${quizFile.name}_${quizFile.size}_${quizFile.lastModified}`;
    } else if (documentSource === "paste") {
      documentHash = `paste_${quizDocText.length}_${selectedDifficulty}`;
    }

    if (pendingUploadsRef.current.has(documentHash)) {
      toast.warning("This document is already being processed. Please wait...");
      return;
    }

    pendingUploadsRef.current.add(documentHash);
    setIsLoading(true);

    try {
      const result = await withErrorHandling(async () => {
        let documentText = "";

        if (documentSource === "upload" && quizFile) {
          const fileExt = quizFile.name.split('.').pop()?.toLowerCase();

          // Validate file size
          const sizeValidation = fileSizeValidator.validate(quizFile);
          if (!sizeValidation.valid) {
            throw new Error(sizeValidation.error);
          }

          if (fileExt === 'pdf') {
            // For PDFs, upload and send URL to generate-quiz function
            // Queue the upload to prevent worker overload
            const requestId = `pdf_upload_${user?.id}_${documentHash}`;
            
            await requestQueue.enqueue(requestId, async () => {
              const fileName = `quiz-docs/${Date.now()}-${Math.random().toString(36).substring(2)}.pdf`;

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('pdf-conversions')
                .upload(fileName, quizFile);

              if (uploadError) throw uploadError;

              const { data: urlData } = supabase.storage
                .from('pdf-conversions')
                .getPublicUrl(fileName);

              // Generate questions directly from PDF using AI
              const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                  subject: "Document Content",
                  topic: "Custom Document",
                  difficulty: selectedDifficulty,
                  numberOfQuestions: customNumberOfQuestions,
                  pdfUrl: urlData.publicUrl
                }
              });

              if (error) throw error;

              if (data.questions && Array.isArray(data.questions)) {
                setQuestions(data.questions);
                setSelectedSubject("Document-Based Quiz");
                setSelectedTopic(quizFile.name);
                startGame(data.questions);
              } else {
                throw new Error("Invalid response format");
              }
            });
            return; // Exit early since we handled PDF
          } else {
            // For text-based files, read directly
            const fileContent = await quizFile.text();
            documentText = fileContent;
          }
        } else if (documentSource === "paste") {
          documentText = quizDocText;
        }

        if (!documentText.trim()) {
          throw new Error("No text content found in the document");
        }

        // Queue the text-based request
        const requestId = `text_quiz_${user?.id}_${documentHash}`;
        
        await requestQueue.enqueue(requestId, async () => {
          const { data, error } = await supabase.functions.invoke('generate-quiz', {
            body: {
              subject: "Document Content",
              topic: "Custom Document",
              difficulty: selectedDifficulty,
              numberOfQuestions: customNumberOfQuestions,
              documentText: documentText
            }
          });

          if (error) throw error;

          if (data.questions && Array.isArray(data.questions)) {
            setQuestions(data.questions);
            setSelectedSubject("Document-Based Quiz");
            setSelectedTopic(quizFile ? quizFile.name : "Pasted Text");
            startGame(data.questions);
          } else {
            throw new Error("Invalid response format");
          }
        });
      }, "document quiz generation");
    } catch (error: any) {
      console.error("Error in generateDocumentQuestions:", error);
    } finally {
      pendingUploadsRef.current.delete(documentHash);
      setIsLoading(false);
    }
  };

  const startGame = (questionsToUse: Question[], quizData?: Quiz) => {
    setQuestions(questionsToUse);
    setGameState("playing");
    setCurrentQuestionIndex(0);
    setScore(0);
    setCorrectAnswers(0);
    setStreak(0);
    setUserSubmittedAnswers(new Array(questionsToUse.length).fill(null));
    setSelectedAnswer(null);
    setSubmittedQuiz(false);
    
    // Set timer based on mode
    // If quizData is provided (from database), use its total_time
    // Otherwise use UI state (for AI-generated quizzes with aiQuizTotalTimeMinutes)
    const isTimed = quizData?.is_timed !== undefined ? quizData.is_timed : (timerMode === 'timed');
    
    let totalSeconds = 0;
    if (isTimed) {
      if (quizData?.total_time) {
        totalSeconds = quizData.total_time;
      } else {
        // AI quiz - convert minutes to seconds
        totalSeconds = parseInt(aiQuizTotalTimeMinutes, 10) * 60;
      }
      setTimeLeft(totalSeconds);
      setTimerActive(true);
    } else {
      // Untimed mode - no timer
      setTimeLeft(0);
      setTimerActive(false);
    }
    setStartTime(Date.now());
  };

  const handleTimeUp = () => {
    if (timerMode === 'timed' && !submittedQuiz) {
      toast.error("Time's up! Submitting your quiz...");
      setTimeout(() => {
        handleSubmitQuiz();
      }, 1500);
    }
  };

  const handleSelectAnswer = (answerIndex: number) => {
    // Just store the answer without any feedback
    setSelectedAnswer(answerIndex);
    const updatedAnswers = [...userSubmittedAnswers];
    updatedAnswers[currentQuestionIndex] = answerIndex;
    setUserSubmittedAnswers(updatedAnswers);
    // No toast, no feedback, no auto-progression
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(userSubmittedAnswers[currentQuestionIndex - 1]);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(userSubmittedAnswers[currentQuestionIndex + 1]);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setSelectedAnswer(userSubmittedAnswers[index]);
  };

  const handleSubmitQuiz = async () => {
    // Mark quiz as submitted
    setSubmittedQuiz(true);
    setTimerActive(false);
    
    // Calculate scores based on stored answers
    let correctCount = 0;
    let totalScore = 0;
    
    questions.forEach((q, idx) => {
      const userAnswer = userSubmittedAnswers[idx];
      if (userAnswer === q.correctAnswer) {
        correctCount++;
        totalScore += q.points;
      }
    });
    
    setCorrectAnswers(correctCount);
    setScore(totalScore);
    
    // Save attempt
    await saveAttempt();
    
    // Show results
    setGameState("results");
  };

  const saveAttempt = async () => {
    if (!user) return;
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    
    const { error } = await supabase.from("quiz_attempts").insert({
      quiz_id: currentQuizId,
      user_id: user.id,
      score: score,
      total_points: totalPoints,
      correct_answers: correctAnswers,
      total_questions: questions.length,
      time_taken: timeTaken,
      subject: selectedSubject || "Mixed",
      topic: selectedTopic || null,
      answers: userSubmittedAnswers
    });

    if (error) {
      console.error("Error saving attempt:", error);
    } else {
      fetchHistory();
      toast.success("Quiz completed and saved!");

      // Create notification for quiz completion
      await notifyQuizCompletion(
        user.id,
        score,
        questions.length,
        selectedSubject || "Mixed"
      );

      // Check for achievements
      await checkAndNotifyAchievements(user.id);
    }
  };

  const reviewAttempt = async (attempt: QuizAttempt) => {
    // For AI-generated quizzes without quiz_id, we won't have a stored quiz record
    // We'll reconstruct from the saved data
    
    setReviewingAttempt(attempt);
    setUserAnswers(attempt.answers || []);
    
    // If this was a joined quiz, fetch the quiz details
    if (attempt.quiz_id) {
      try {
        const { data: quiz, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", attempt.quiz_id)
          .single();

        if (quizError) throw quizError;
        setReviewQuiz(quiz);
      } catch (error) {
        console.error("Error fetching quiz details:", error);
        toast.error("Could not load quiz details");
      }
    }
    
    setGameState("review");
  };

  const reattemptQuiz = async (attempt: QuizAttempt) => {
    // If it's a joined quiz, rejoin and restart
    if (attempt.quiz_id) {
      try {
        const { data: quiz, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", attempt.quiz_id)
          .single();

        if (quizError) throw quizError;

        const { data: questionsData, error: questionsError } = await supabase
          .from("quiz_questions")
          .select("*")
          .eq("quiz_id", quiz.id)
          .order("order_index");

        if (questionsError) throw questionsError;

        const formattedQuestions: Question[] = questionsData.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options as string[],
          correctAnswer: q.correct_answer,
          explanation: q.explanation || undefined,
          points: q.points
        }));

        setJoinedQuiz(quiz);
        setCurrentQuizId(quiz.id);
        setSelectedSubject(quiz.subject);
        setSelectedTopic(quiz.topic || "");
        setQuestions(formattedQuestions);
        startGame(formattedQuestions, quiz);
      } catch (error: any) {
        console.error("Error reattempting quiz:", error);
        toast.error("Failed to reattempt quiz");
      }
    } else {
      // For AI-generated quizzes without stored questions, regenerate
      setGameState("setup");
      toast.info("Please configure and regenerate the quiz to reattempt");
    }
  };

  // Convert time to seconds based on unit
  const getQuizTimeInSeconds = () => {
    const amount = parseInt(quizTotalTimeAmount, 10);
    if (quizTotalTimeUnit === 'seconds') return amount;
    if (quizTotalTimeUnit === 'minutes') return amount * 60;
    if (quizTotalTimeUnit === 'hours') return amount * 3600;
    return amount * 60;
  };

  const createQuiz = async () => {
    if (!user) {
      toast.error("Please sign in to create quizzes");
      return;
    }
    
    if (!quizTitle || manualQuestions.length === 0) {
      toast.error("Please add a title and at least one question");
      return;
    }

    setIsLoading(true);
    try {
      const quizCodeGenerated = Math.random().toString(36).substring(2, 8).toUpperCase();
      const totalTimeInSeconds = getQuizTimeInSeconds();
      
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          creator_id: user.id,
          title: quizTitle,
          description: quizDescription,
          subject: selectedSubject || "Mixed",
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          quiz_code: quizCodeGenerated,
          total_questions: manualQuestions.length,
          cash_prize: cashPrize,
          gift_description: giftDescription || null,
          is_ai_generated: false,
          is_timed: quizIsTimed,
          time_per_question: null,
          total_time: quizIsTimed ? totalTimeInSeconds : null
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = manualQuestions.map((q, idx) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        points: q.points,
        order_index: idx
      }));

      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast.success(`Quiz created! Code: ${quizCodeGenerated}`);
      setGameState("menu");
      resetCreateForm();
    } catch (error: any) {
      console.error("Error creating quiz:", error);
      toast.error(error.message || "Failed to create quiz");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAIQuizAsShareable = async () => {
    if (!user) {
      toast.error("Please sign in to save and share quizzes");
      return;
    }

    setIsLoading(true);
    try {
      const quizCodeGenerated = Math.random().toString(36).substring(2, 8).toUpperCase();
      const totalTimeInSeconds = timerMode === 'timed' ? parseInt(aiQuizTotalTimeMinutes, 10) * 60 : null;
      
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          creator_id: user.id,
          title: `${selectedSubject} Quiz - ${selectedDifficulty}`,
          description: `STEMGEN-generated ${selectedDifficulty} ${selectedSubject}${selectedTopic ? ` - ${selectedTopic}` : ""} quiz`,
          subject: selectedSubject || "Mixed",
          topic: selectedTopic || null,
          difficulty: selectedDifficulty,
          quiz_code: quizCodeGenerated,
          total_questions: questions.length,
          cash_prize: 0,
          gift_description: null,
          is_ai_generated: true,
          is_timed: timerMode === 'timed',
          time_per_question: null,
          total_time: totalTimeInSeconds
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = questions.map((q, idx) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        points: q.points,
        order_index: idx
      }));

      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      setGeneratedQuizCode(quizCodeGenerated);
      setCurrentQuizId(quiz.id);
      toast.success(`Quiz saved! Code: ${quizCodeGenerated}`);
    } catch (error: any) {
      console.error("Error saving quiz:", error);
      toast.error(error.message || "Failed to save quiz");
    } finally {
      setIsLoading(false);
    }
  };

  const shareQuiz = async (code: string) => {
    const shareUrl = `${window.location.origin}/stem-challenge-arena?code=${code}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Quiz link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const joinQuiz = async () => {
    if (!quizCode) {
      toast.error("Please enter a quiz code");
      return;
    }

    setIsLoading(true);
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("quiz_code", quizCode.toUpperCase())
        .maybeSingle();

      if (quizError) throw quizError;
      if (!quiz) {
        toast.error("Quiz not found");
        return;
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("order_index");

      if (questionsError) throw questionsError;

      const formattedQuestions: Question[] = questionsData.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options as string[],
        correctAnswer: q.correct_answer,
        explanation: q.explanation || undefined,
        points: q.points
      }));

      setJoinedQuiz(quiz);
      setCurrentQuizId(quiz.id);
      setSelectedSubject(quiz.subject);
      setSelectedTopic(quiz.topic || "");
      setQuestions(formattedQuestions);
      
      toast.success(`Joined quiz: ${quiz.title}`);
    } catch (error: any) {
      console.error("Error joining quiz:", error);
      toast.error(error.message || "Failed to join quiz");
    } finally {
      setIsLoading(false);
    }
  };

  const startJoinedQuiz = () => {
    if (questions.length > 0 && joinedQuiz) {
      startGame(questions, joinedQuiz);
    }
  };

  const addManualQuestion = () => {
    if (!currentManualQuestion.question || currentManualQuestion.options.some(o => !o)) {
      toast.error("Please fill in the question and all options");
      return;
    }
    setManualQuestions([...manualQuestions, { ...currentManualQuestion }]);
    setCurrentManualQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 10
    });
    toast.success("Question added!");
  };

  const parseQuestionFile = async (file: File): Promise<Question[]> => {
    if (!file) return [];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

    if (rows.length === 0) {
      throw new Error("Uploaded file contains no rows.");
    }

    const headerRow = rows[0].map((cell) => String(cell || "").trim().toLowerCase());
    const isHeaderRow = headerRow.some((cell) => [
      "question",
      "question_text",
      "option1",
      "option2",
      "option3",
      "option4",
      "correct_answer",
      "correctanswer",
      "answer"
    ].includes(cell));

    const normalizeCell = (value: any) => String(value ?? "").trim();
    const parseCorrectAnswer = (raw: string, options: string[]) => {
      const value = raw.trim();
      if (!value) {
        throw new Error("Missing correct answer for one of the questions.");
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        if (numeric >= 1 && numeric <= options.length) return numeric - 1;
        if (numeric >= 0 && numeric < options.length) return numeric;
      }
      const optionMatch = value.toLowerCase().match(/^\s*(?:option|opt|choice)\s*([1-4])\s*$/);
      if (optionMatch) {
        return Number(optionMatch[1]) - 1;
      }
      const letters: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
      const lower = value.toLowerCase();
      if (letters[lower] !== undefined) return letters[lower];
      const optionIndex = options.findIndex((opt) => opt.toLowerCase() === lower);
      if (optionIndex !== -1) return optionIndex;
      throw new Error(`Unable to parse correct answer: ${value}`);
    };

    const findHeader = (names: string[]) => headerRow.findIndex((cell) => names.includes(cell));

    const questionIndex = findHeader(["question", "question_text", "prompt"]);
    const option1Index = findHeader(["option1", "answer1", "choice1"]);
    const option2Index = findHeader(["option2", "answer2", "choice2"]);
    const option3Index = findHeader(["option3", "answer3", "choice3"]);
    const option4Index = findHeader(["option4", "answer4", "choice4"]);
    const correctAnswerIndex = findHeader(["correct_answer", "answer", "correctanswer", "correct"]);
    const pointsIndex = findHeader(["points", "score"]);
    const explanationIndex = findHeader(["explanation", "explain"]);

    const parsedQuestions: Question[] = [];
    const startRow = isHeaderRow ? 1 : 0;

    for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] as any[];
      const cells = row.map(normalizeCell);
      if (cells.every((cell) => !cell)) continue;

      const questionText = isHeaderRow
        ? normalizeCell(cells[questionIndex] || "")
        : normalizeCell(cells[0] || "");

      const options = isHeaderRow
        ? [
            normalizeCell(cells[option1Index] || ""),
            normalizeCell(cells[option2Index] || ""),
            normalizeCell(cells[option3Index] || ""),
            normalizeCell(cells[option4Index] || "")
          ]
        : [
            normalizeCell(cells[1] || ""),
            normalizeCell(cells[2] || ""),
            normalizeCell(cells[3] || ""),
            normalizeCell(cells[4] || "")
          ];

      const rawCorrect = isHeaderRow
        ? normalizeCell(cells[correctAnswerIndex] || "")
        : normalizeCell(cells[5] || "");
      const rawPoints = isHeaderRow
        ? normalizeCell(cells[pointsIndex] || "")
        : normalizeCell(cells[6] || "");
      const explanation = isHeaderRow
        ? normalizeCell(cells[explanationIndex] || "")
        : normalizeCell(cells[7] || "");

      if (!questionText) {
        throw new Error(`Missing question text in row ${rowIndex + 1}.`);
      }
      if (options.some((opt) => !opt)) {
        throw new Error(`Each question must include four options. Issue on row ${rowIndex + 1}.`);
      }
      const correctAnswer = parseCorrectAnswer(rawCorrect, options);
      const points = Number(rawPoints) || 10;

      parsedQuestions.push({
        question: questionText,
        options,
        correctAnswer,
        explanation: explanation || undefined,
        points
      });
    }

    if (parsedQuestions.length === 0) {
      throw new Error("No valid questions were found in the uploaded file.");
    }

    return parsedQuestions;
  };

  const handleUploadQuestions = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsingQuestions(true);
    try {
      const parsedQuestions = await parseQuestionFile(file);
      setManualQuestions((prev) => [...prev, ...parsedQuestions]);
      toast.success(`${parsedQuestions.length} questions imported from ${file.name}`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error?.message || "Failed to parse uploaded questions.");
    } finally {
      setIsParsingQuestions(false);
      event.target.value = "";
    }
  };

  const resetCreateForm = () => {
    setQuizTitle("");
    setQuizDescription("");
    setCashPrize(0);
    setGiftDescription("");
    setManualQuestions([]);
    setCurrentManualQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 10
    });
  };

  const getPerformanceRank = () => {
    const percentage = (correctAnswers / questions.length) * 100;
    if (percentage >= 90) return { rank: "STEM Master", icon: <Crown className="w-6 h-6" />, color: "text-accent" };
    if (percentage >= 70) return { rank: "STEM Expert", icon: <Star className="w-6 h-6" />, color: "text-primary" };
    if (percentage >= 50) return { rank: "STEM Scholar", icon: <Trophy className="w-6 h-6" />, color: "text-blue-500" };
    return { rank: "STEM Learner", icon: <Zap className="w-6 h-6" />, color: "text-muted-foreground" };
  };

  const currentQuestion = questions[currentQuestionIndex];
  const availableTopics = SUBJECTS.find(s => s.value === selectedSubject)?.topics || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">STEM Challenge Arena</h1>
                <p className="text-sm text-muted-foreground">Test your knowledge and earn rewards</p>
              </div>
            </div>
            {gameState === "playing" && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
                  <Trophy className="w-5 h-5 text-accent" />
                  <span className="font-bold text-foreground">{score}</span>
                </div>
                {streak > 1 && (
                  <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 rounded-lg">
                    <Flame className="w-5 h-5 text-destructive" />
                    <span className="font-bold text-foreground">{streak}x</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Menu State */}
          {gameState === "menu" && (
            <div className="space-y-6">
              <PageHeroBanner image={heroChallengeImg} title="Ready to Challenge Yourself?" subtitle="Take AI-generated quizzes, create your own challenges, or join quizzes shared by others!" badge="Win Prizes" />
              <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">Ready to Challenge Yourself?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Take STEMGEN-AI-generated quizzes, create your own challenges, or join quizzes shared by others!
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                  <Button size="lg" className="w-full sm:w-auto" onClick={() => setGameState("setup")}>
                    <Sparkles className="w-5 h-5 mr-2" />
                    STEMGEN-AI Quiz
                  </Button>
                  <Button size="lg" className="w-full sm:w-auto" variant="outline" onClick={() => setGameState("create")}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Quiz
                  </Button>
                  <Button size="lg" className="w-full sm:w-auto" variant="outline" onClick={() => setGameState("join")}>
                    <Users className="w-5 h-5 mr-2" />
                    Join Quiz
                  </Button>
                  <Button size="lg" className="w-full sm:w-auto" variant="outline" onClick={() => setGameState("history")}>
                    <History className="w-5 h-5 mr-2" />
                    History
                  </Button>
                  <Button size="lg" className="w-full sm:w-auto" variant="outline" onClick={() => setGameState("flashcards")}>
                    <Layers className="w-5 h-5 mr-2" />
                    Flashcards
                  </Button>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/leaderboard")}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Leaderboard</h4>
                      <p className="text-sm text-muted-foreground">See top performers</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/dashboard")}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Learning Progress</h4>
                      <p className="text-sm text-muted-foreground">Track your growth</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Setup State - AI Quiz Configuration */}
          {gameState === "setup" && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Configure STEMGEN-AI Quiz
                </h3>

                {/* Mode Selection */}
                <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
                  <Label className="mb-2 block">Quiz Mode</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all hover:border-primary/50">
                      <input 
                        type="radio" 
                        checked={!multiSetup && !documentSetup} 
                        onChange={() => { setMultiSetup(false); setDocumentSetup(false); }} 
                        className="w-4 h-4" 
                      />
                      <div>
                        <span className="text-sm font-medium">Single Subject</span>
                        <p className="text-xs text-muted-foreground">Choose from predefined subjects</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all hover:border-primary/50">
                      <input 
                        type="radio" 
                        checked={multiSetup} 
                        onChange={() => { setMultiSetup(true); setDocumentSetup(false); }} 
                        className="w-4 h-4" 
                      />
                      <div>
                        <span className="text-sm font-medium">Multiple Subjects</span>
                        <p className="text-xs text-muted-foreground">Combine multiple topics</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all hover:border-primary/50">
                      <input 
                        type="radio" 
                        checked={documentSetup} 
                        onChange={() => { setDocumentSetup(true); setMultiSetup(false); }} 
                        className="w-4 h-4" 
                      />
                      <div>
                        <span className="text-sm font-medium">From Document</span>
                        <p className="text-xs text-muted-foreground">Upload PDF/slides or paste text</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Single Subject Mode */}
                {!multiSetup && !documentSetup ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Subject *</Label>
                      <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedTopic(""); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {availableTopics.length > 0 && (
                      <div>
                        <Label>Topic (Optional)</Label>
                        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a topic" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTopics.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Difficulty</Label>
                      <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy (10 pts/question)</SelectItem>
                          <SelectItem value="medium">Medium (20 pts/question)</SelectItem>
                          <SelectItem value="hard">Hard (30 pts/question)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Number of Questions</Label>
                      <div className="space-y-2 ">
                        <div className="flex gap-2 ">
                          <input 
                            type="number" 
                            value={customNumberOfQuestions}
                            onChange={(e) => setCustomNumberOfQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                            placeholder="Enter number"
                            className="flex-1 px-3 py-2 border rounded-md border-border bg-secondary/50"
                            min="1"
                            max="100"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Or select from presets:</p>
                        <Select value={numberOfQuestions.toString()} onValueChange={(v) => {
                          setNumberOfQuestions(parseInt(v));
                          setCustomNumberOfQuestions(parseInt(v));
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 Questions</SelectItem>
                            <SelectItem value="10">10 Questions</SelectItem>
                            <SelectItem value="15">15 Questions</SelectItem>
                            <SelectItem value="20">20 Questions</SelectItem>
                            <SelectItem value="30">30 Questions</SelectItem>
                            <SelectItem value="40">40 Questions</SelectItem>
                            <SelectItem value="50">50 Questions</SelectItem>
                             <SelectItem value="60">60 Questions</SelectItem>
                              <SelectItem value="70">70 Questions</SelectItem>
                              <SelectItem value="80">80 Questions</SelectItem>
                              <SelectItem value="90">90 Questions</SelectItem>
                              <SelectItem value="100">100 Questions</SelectItem>
                              <SelectItem value="120">120 Questions</SelectItem>
                              <SelectItem value="130">130 Questions</SelectItem>
                              <SelectItem value="150">150 Questions</SelectItem>
                              <SelectItem value="200">200 Questions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">⏱️ Total Quiz Time</Label>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-sm mb-2 block">Minutes</Label>
                          <Select value={aiQuizTotalTimeMinutes} onValueChange={setAiQuizTotalTimeMinutes}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 Minute</SelectItem>
                              <SelectItem value="2">2 Minutes</SelectItem>
                              <SelectItem value="3">3 Minutes</SelectItem>
                              <SelectItem value="5">5 Minutes</SelectItem>
                              <SelectItem value="10">10 Minutes</SelectItem>
                              <SelectItem value="15">15 Minutes</SelectItem>
                              <SelectItem value="20">20 Minutes</SelectItem>
                              <SelectItem value="30">30 Minutes</SelectItem>
                              <SelectItem value="40">40 Minutes</SelectItem>
                              <SelectItem value="50">50 Minutes</SelectItem>
                              <SelectItem value="60">60 Minutes</SelectItem>
                              <SelectItem value="80">80 Minutes</SelectItem>
                              <SelectItem value="100">100 Minutes</SelectItem>
                              <SelectItem value="120">120 Minutes</SelectItem>

                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Total time for all questions in timed mode</p>
                    </div>

                    {/* Timer Mode Selection */}
                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">Quiz Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setTimerMode('timed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'timed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Clock className="w-4 h-4 mb-1 mx-auto" />
                          <span>Timed</span>
                        </button>
                        <button
                          onClick={() => setTimerMode('untimed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'untimed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span>Untimed</span>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {timerMode === 'timed' 
                          ? 'Quiz will auto-submit when time runs out' 
                          : 'Take your time, submit when ready'}
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button onClick={generateQuestions} disabled={isLoading || !selectedSubject}>
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Start Quiz
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setGameState("menu")}>Cancel</Button>
                    </div>
                  </div>
                ) : multiSetup ? (
                  /* Multi-Subject Mode */
                  <div className="space-y-4">
                    <div>
                      <Label>Difficulty</Label>
                      <Select value={setupDifficulty} onValueChange={setSetupDifficulty}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy (10 pts/question)</SelectItem>
                          <SelectItem value="medium">Medium (20 pts/question)</SelectItem>
                          <SelectItem value="hard">Hard (30 pts/question)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subject Selection */}
                    <div>
                      <Label>Select Subjects to Include *</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 mt-2">
                        {SUBJECTS.map(subject => (
                          <button
                            key={subject.value}
                            onClick={() => {
                              if (selectedSubjectsWithTopics.find(s => s.subject === subject.value)) {
                                removeSubjectFromMultiSetup(subject.value);
                              } else {
                                addSubjectToMultiSetup(subject.value);
                              }
                            }}
                            className={`p-2 sm:p-3 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all min-h-[40px] flex items-center justify-center ${
                              selectedSubjectsWithTopics.find(s => s.subject === subject.value)
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {subject.value}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selected Subjects Configuration */}
                    {selectedSubjectsWithTopics.length > 0 && (
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold text-sm">Configure Selected Subjects</h4>
                        {selectedSubjectsWithTopics.map((selection) => {
                          const subjectData = SUBJECTS.find(s => s.value === selection.subject);
                          return (
                            <Card key={selection.subject} className="p-4 bg-secondary/30">
                              <div className="flex items-start justify-between mb-3">
                                <h5 className="font-medium text-foreground">{selection.subject}</h5>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSubjectFromMultiSetup(selection.subject)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Topics Selection */}
                              {subjectData && subjectData.topics.length > 0 && (
                                <div className="mb-3">
                                  <Label className="text-xs">Topics (Optional - leave empty for all)</Label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 mt-2">
                                    {subjectData.topics.map(topic => (
                                      <label key={topic} className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm min-h-[40px] flex-col sm:flex-row justify-center sm:justify-start">
                                        <input
                                          type="checkbox"
                                          checked={selection.topics.includes(topic)}
                                          onChange={() => toggleTopicForSubject(selection.subject, topic)}
                                          className="w-4 h-4"
                                        />
                                        <span className="line-clamp-2">{topic}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Custom Topic Input */}
                              <div className="mb-3">
                                <Label className="text-xs">Or enter custom topic</Label>
                                <Input
                                  value={selection.customTopic || ""}
                                  onChange={(e) => updateSubjectCustomTopic(selection.subject, e.target.value)}
                                  placeholder="e.g., Quantum Computing"
                                  className="text-sm mt-1"
                                />
                              </div>

                              {/* Questions per Subject */}
                              <div>
                                <Label className="text-xs">Questions for {selection.subject}</Label>
                                <Select value={selection.questionCount.toString()} onValueChange={(v) => updateSubjectQuestionCount(selection.subject, parseInt(v))}>
                                  <SelectTrigger className="text-sm mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[3, 5, 10, 15, 20].map(num => (
                                      <SelectItem key={num} value={num.toString()}>{num} Questions</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </Card>
                          );
                        })}
                        <div className="text-sm text-muted-foreground bg-primary/5 p-3 rounded">
                          Total questions: {selectedSubjectsWithTopics.reduce((sum, s) => sum + s.questionCount, 0)}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">⏱️ Total Quiz Time</Label>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-sm mb-2 block">Minutes</Label>
                          <Select value={aiQuizTotalTimeMinutes} onValueChange={setAiQuizTotalTimeMinutes}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 Minute</SelectItem>
                              <SelectItem value="2">2 Minutes</SelectItem>
                              <SelectItem value="3">3 Minutes</SelectItem>
                              <SelectItem value="5">5 Minutes</SelectItem>
                              <SelectItem value="10">10 Minutes</SelectItem>
                              <SelectItem value="15">15 Minutes</SelectItem>
                              <SelectItem value="20">20 Minutes</SelectItem>
                              <SelectItem value="30">30 Minutes</SelectItem>
                              <SelectItem value="40">40 Minutes</SelectItem>
                              <SelectItem value="50">50 Minutes</SelectItem>
                              <SelectItem value="60">60 Minutes</SelectItem>
                              <SelectItem value="80">80 Minutes</SelectItem>
                              <SelectItem value="100">100 Minutes</SelectItem>
                              <SelectItem value="120">120 Minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Total time for all questions in timed mode</p>
                    </div>

                    {/* Timer Mode Selection */}
                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">Quiz Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setTimerMode('timed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'timed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Clock className="w-4 h-4 mb-1 mx-auto" />
                          <span>Timed</span>
                        </button>
                        <button
                          onClick={() => setTimerMode('untimed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'untimed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span>Untimed</span>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {timerMode === 'timed' 
                          ? 'Quiz will auto-submit when time runs out' 
                          : 'Take your time, submit when ready'}
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button 
                        onClick={generateMultiSubjectQuestions} 
                        disabled={isLoading || selectedSubjectsWithTopics.length === 0}
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Start Quiz
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setGameState("menu")}>Cancel</Button>
                    </div>
                  </div>
                ) : documentSetup ? (
                  /* Document-Based Mode */
                  <div className="space-y-4">
                    <Tabs value={documentSource} onValueChange={(v) => setDocumentSource(v as "upload" | "paste")}>
                      <TabsList className="mb-4">
                        <TabsTrigger value="upload">Upload File</TabsTrigger>
                        <TabsTrigger value="paste">Paste Text</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload" className="space-y-4">
                        <div>
                          <Label>Upload Document (TXT, PDF, DOC, DOCX - Note: PDF content extraction may be limited)</Label>
                          <Input 
                            type="file" 
                            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt" 
                            onChange={(e) => setQuizFile(e.target.files?.[0] || null)} 
                            className="mt-1"
                          />
                          {quizFile && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Selected: {quizFile.name} ({(quizFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="paste" className="space-y-4">
                        <div>
                          <Label>Paste Document Text</Label>
                          <Textarea
                            value={quizDocText}
                            onChange={(e) => setQuizDocText(e.target.value)}
                            placeholder="Paste your document text here..."
                            className="min-h-[200px] mt-1"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div>
                      <Label>Difficulty</Label>
                      <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy (10 pts/question)</SelectItem>
                          <SelectItem value="medium">Medium (20 pts/question)</SelectItem>
                          <SelectItem value="hard">Hard (30 pts/question)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Number of Questions</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={customNumberOfQuestions}
                            onChange={(e) => setCustomNumberOfQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                            placeholder="Enter number"
                            className="flex-1 px-3 py-2 border rounded-md border-border bg-secondary/50"
                            min="1"
                            max="100"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Or select from presets:</p>
                        <Select value={numberOfQuestions.toString()} onValueChange={(v) => {
                          setNumberOfQuestions(parseInt(v));
                          setCustomNumberOfQuestions(parseInt(v));
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 Questions</SelectItem>
                            <SelectItem value="10">10 Questions</SelectItem>
                            <SelectItem value="15">15 Questions</SelectItem>
                            <SelectItem value="20">20 Questions</SelectItem>
                            <SelectItem value="30">30 Questions</SelectItem>
                            <SelectItem value="40">40 Questions</SelectItem>
                            <SelectItem value="50">50 Questions</SelectItem>
                             <SelectItem value="60">60 Questions</SelectItem>
                              <SelectItem value="70">70 Questions</SelectItem>
                              <SelectItem value="80">80 Questions</SelectItem>
                              <SelectItem value="90">90 Questions</SelectItem>
                              <SelectItem value="100">100 Questions</SelectItem>
                              <SelectItem value="120">120 Questions</SelectItem>
                              <SelectItem value="130">130 Questions</SelectItem>
                              <SelectItem value="150">150 Questions</SelectItem>
                              <SelectItem value="200">200 Questions</SelectItem>
                              
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">⏱️ Total Quiz Time</Label>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-sm mb-2 block">Minutes</Label>
                          <Select value={aiQuizTotalTimeMinutes} onValueChange={setAiQuizTotalTimeMinutes}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 Minute</SelectItem>
                              <SelectItem value="2">2 Minutes</SelectItem>
                              <SelectItem value="3">3 Minutes</SelectItem>
                              <SelectItem value="5">5 Minutes</SelectItem>
                              <SelectItem value="10">10 Minutes</SelectItem>
                              <SelectItem value="15">15 Minutes</SelectItem>
                              <SelectItem value="20">20 Minutes</SelectItem>
                              <SelectItem value="30">30 Minutes</SelectItem>
                              <SelectItem value="40">40 Minutes</SelectItem>
                              <SelectItem value="50">50 Minutes</SelectItem>
                              <SelectItem value="60">60 Minutes</SelectItem>
                              <SelectItem value="80">80 Minutes</SelectItem>
                              <SelectItem value="100">100 Minutes</SelectItem>
                              <SelectItem value="120">120 Minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Total time for all questions in timed mode</p>
                    </div>

                    {/* Timer Mode Selection */}
                    <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                      <Label className="font-medium">Quiz Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setTimerMode('timed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'timed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Clock className="w-4 h-4 mb-1 mx-auto" />
                          <span>Timed</span>
                        </button>
                        <button
                          onClick={() => setTimerMode('untimed')}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            timerMode === 'untimed'
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span>Untimed</span>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {timerMode === 'timed' 
                          ? 'Quiz will auto-submit when time runs out' 
                          : 'Take your time, submit when ready'}
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button 
                        onClick={generateDocumentQuestions} 
                        disabled={isLoading || (documentSource === "upload" && !quizFile) || (documentSource === "paste" && !quizDocText.trim())}
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Generate Quiz
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setGameState("menu")}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          )}

          {/* Create Quiz State */}
          {gameState === "create" && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Create Custom Quiz
                </h3>
                
                <Tabs defaultValue="details">
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">Quiz Details</TabsTrigger>
                    <TabsTrigger value="questions">Questions ({manualQuestions.length})</TabsTrigger>
                    <TabsTrigger value="prizes">Prizes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div>
                      <Label>Quiz Title *</Label>
                      <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="Enter quiz title" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={quizDescription} onChange={(e) => setQuizDescription(e.target.value)} placeholder="Describe your quiz" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Subject</Label>
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECTS.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Difficulty</Label>
                        <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Timing Settings */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-3 mb-4">
                        <input
                          type="checkbox"
                          id="quizTimed"
                          checked={quizIsTimed}
                          onChange={(e) => setQuizIsTimed(e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <Label htmlFor="quizTimed" className="cursor-pointer font-medium">
                          ⏱️ Enable Timed Mode
                        </Label>
                      </div>
                      
                      {quizIsTimed && (
                        <div className="flex gap-4 items-end">
                          <div className="flex-1">
                            <Label>Quiz Duration</Label>
                            <Input 
                              type="number" 
                              value={quizTotalTimeAmount} 
                              onChange={(e) => setQuizTotalTimeAmount(e.target.value)}
                              min="1"
                              max="3600"
                              step="1"
                            />
                          </div>
                          <div className="flex-1">
                            <Label>Unit</Label>
                            <Select value={quizTotalTimeUnit} onValueChange={(e) => setQuizTotalTimeUnit(e as 'seconds' | 'minutes' | 'hours')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="seconds">Seconds</SelectItem>
                                <SelectItem value="minutes">Minutes</SelectItem>
                                <SelectItem value="hours">Hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      
                      {!quizIsTimed && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                          ✓ No time limits - participants answer at their own pace
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="questions" className="space-y-4">
                    <Card className="p-4 bg-secondary/50">
                      <h4 className="font-medium mb-3">Upload Questions</h4>
                      <div className="space-y-2">
                        <div>
                          <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleUploadQuestions(e)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Upload a CSV or Excel file with columns: <strong>question, option1, option2, option3, option4, correct_answer</strong> and optional <strong>points</strong>, <strong>explanation</strong>.
                        </p>
                        {isParsingQuestions && <p className="text-sm text-muted-foreground">Parsing questions...</p>}
                      </div>
                    </Card>
                    <Card className="p-4 bg-secondary/50">
                      <h4 className="font-medium mb-3">Add Question</h4>
                      <div className="space-y-3">
                        <div>
                          <Label>Question *</Label>
                          <Textarea 
                            value={currentManualQuestion.question} 
                            onChange={(e) => setCurrentManualQuestion({...currentManualQuestion, question: e.target.value})}
                            placeholder="Enter your question"
                          />
                        </div>
                        <RadioGroup 
                          value={currentManualQuestion.correctAnswer.toString()} 
                          onValueChange={(val) => setCurrentManualQuestion({...currentManualQuestion, correctAnswer: parseInt(val)})}
                        >
                          {currentManualQuestion.options.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <RadioGroupItem
                                value={idx.toString()}
                                id={`manual-option-${idx}`}
                              />
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...currentManualQuestion.options];
                                  newOpts[idx] = e.target.value;
                                  setCurrentManualQuestion({...currentManualQuestion, options: newOpts});
                                }}
                                placeholder={`Option ${idx + 1}`}
                                className="flex-1"
                              />
                              <Label htmlFor={`manual-option-${idx}`} className="text-xs text-muted-foreground whitespace-nowrap">
                                {currentManualQuestion.correctAnswer === idx ? "✓ Correct" : "Mark correct"}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <div className="flex items-center gap-4">
                          <div>
                            <Label>Points</Label>
                            <Input
                              type="number"
                              value={currentManualQuestion.points}
                              onChange={(e) => setCurrentManualQuestion({...currentManualQuestion, points: parseInt(e.target.value) || 10})}
                              className="w-24"
                            />
                          </div>
                          <Button onClick={addManualQuestion} className="mt-5">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Question
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {manualQuestions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Added Questions</h4>
                        {manualQuestions.map((q, idx) => (
                          <Card key={idx} className="p-3 flex items-center justify-between">
                            <span className="text-sm truncate flex-1">{idx + 1}. {q.question}</span>
                            <Badge>{q.points} pts</Badge>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="prizes" className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Cash Prize (Optional)
                      </Label>
                      <Input
                        type="number"
                        value={cashPrize}
                        onChange={(e) => setCashPrize(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        Gift Description (Optional)
                      </Label>
                      <Textarea
                        value={giftDescription}
                        onChange={(e) => setGiftDescription(e.target.value)}
                        placeholder="Describe the gift/prize for winners"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-3 mt-6">
                  <Button onClick={createQuiz} disabled={isLoading || !quizTitle || manualQuestions.length === 0}>
                    {isLoading ? "Creating..." : "Create Quiz"}
                  </Button>
                  <Button variant="outline" onClick={() => { setGameState("menu"); resetCreateForm(); }}>Cancel</Button>
                </div>
              </Card>
            </div>
          )}

          {/* Join Quiz State */}
          {gameState === "join" && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Join a Quiz
                </h3>
                
                {!joinedQuiz ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Quiz Code</Label>
                      <Input
                        value={quizCode}
                        onChange={(e) => setQuizCode(e.target.value.toUpperCase())}
                        placeholder="Enter 6-character code"
                        maxLength={6}
                        className="text-2xl text-center tracking-widest"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={joinQuiz} disabled={isLoading || quizCode.length < 6}>
                        {isLoading ? "Joining..." : "Join Quiz"}
                      </Button>
                      <Button variant="outline" onClick={() => { setGameState("menu"); setQuizCode(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-secondary/50 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold">{joinedQuiz.title}</h4>
                      {joinedQuiz.description && <p className="text-sm text-muted-foreground mt-1">{joinedQuiz.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge>{joinedQuiz.subject}</Badge>
                        <Badge variant="outline">{joinedQuiz.difficulty}</Badge>
                        <Badge variant="outline">{questions.length} Questions</Badge>
                      </div>
                      {(joinedQuiz.cash_prize > 0 || joinedQuiz.gift_description) && (
                        <div className="mt-3 p-3 bg-accent/10 rounded-lg">
                          <p className="text-sm font-medium text-accent flex items-center gap-2">
                            <Gift className="w-4 h-4" />
                            Prizes Available!
                          </p>
                          {joinedQuiz.cash_prize > 0 && <p className="text-sm">Cash: ${joinedQuiz.cash_prize}</p>}
                          {joinedQuiz.gift_description && <p className="text-sm">{joinedQuiz.gift_description}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={startJoinedQuiz}>
                        <Zap className="w-4 h-4 mr-2" />
                        Start Quiz
                      </Button>
                      <Button variant="outline" onClick={() => { setJoinedQuiz(null); setQuizCode(""); }}>
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* History State */}
          {gameState === "history" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Quiz History
                </h3>
                <Button variant="outline" onClick={() => setGameState("menu")}>Back</Button>
              </div>

              {!user ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">Sign in to view your quiz history</p>
                  <Button onClick={() => navigate("/auth")}>Sign In</Button>
                </Card>
              ) : quizHistory.length === 0 ? (
                <Card className="p-3 sm:p-4 text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">No quiz attempts yet. Start your first challenge!</p>
                </Card>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {quizHistory.map((attempt) => (
                    <Card key={attempt.id} className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-base truncate">{attempt.subject}{attempt.topic ? ` - ${attempt.topic}` : ""}</p>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">
                            {new Date(attempt.completed_at).toLocaleDateString()} • {attempt.correct_answers}/{attempt.total_questions} correct
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg sm:text-2xl font-bold text-primary">{attempt.score}</p>
                          <p className="text-[9px] sm:text-xs text-muted-foreground">
                            {Math.round((attempt.correct_answers / attempt.total_questions) * 100)}% accuracy
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 sm:h-9"
                            onClick={() => reviewAttempt(attempt)}
                          >
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 sm:h-9"
                            onClick={() => reattemptQuiz(attempt)}
                          >
                            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            Reattempt
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Review State */}
          {gameState === "review" && reviewingAttempt && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Review Quiz
                </h3>
                <Button variant="outline" onClick={() => {
                  if (reviewingAttempt.id === 'current') {
                    setGameState("results");
                  } else {
                    setGameState("history");
                  }
                }}>
                  Back
                </Button>
              </div>

              <Card className="p-3 sm:p-6 bg-secondary/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div className="text-center p-2 sm:p-0">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-accent" />
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{reviewingAttempt.score}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Points</p>
                  </div>
                  <div className="text-center p-2 sm:p-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-primary" />
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{reviewingAttempt.correct_answers}/{reviewingAttempt.total_questions}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Correct</p>
                  </div>
                  <div className="text-center p-2 sm:p-0">
                    <Star className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-primary" />
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{Math.round((reviewingAttempt.correct_answers / reviewingAttempt.total_questions) * 100)}%</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Accuracy</p>
                  </div>
                </div>
              </Card>

              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-foreground text-sm sm:text-base">Questions Review</h4>
                {questions.map((q, idx) => {
                  const userAnswer = userSubmittedAnswers[idx];
                  const isAnswered = userAnswer !== null && userAnswer !== undefined;
                  const isCorrect = userAnswer === q.correctAnswer;
                  return (
                    <Card key={idx} className={`p-3 sm:p-4 border-2 ${
                      isAnswered 
                        ? isCorrect 
                          ? "border-primary/30 bg-primary/5" 
                          : "border-destructive/30 bg-destructive/5"
                        : "border-muted/30 bg-muted/5"
                    }`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground">Q{idx + 1}: {q.question}</p>
                          {isAnswered ? (
                            isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                            ) : (
                              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                            )
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground text-xs flex-shrink-0 mt-1">
                              <span>Not answered</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2 ml-4">
                          {q.options.map((option, optIdx) => {
                            const isUserAnswer = userAnswer === optIdx;
                            const isCorrectOption = optIdx === q.correctAnswer;
                            let bgColor = "bg-secondary";
                            let borderColor = "border-border";
                            
                            if (isCorrectOption) {
                              bgColor = "bg-primary/10";
                              borderColor = "border-primary";
                            } else if (isUserAnswer && !isCorrect) {
                              bgColor = "bg-destructive/10";
                              borderColor = "border-destructive";
                            }
                            
                            return (
                              <div key={optIdx} className={`p-2 rounded border-2 ${bgColor} ${borderColor}`}>
                                <div className="flex items-center gap-2">
                                  {isCorrectOption && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                  {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-destructive" />}
                                  <span className="text-sm">{option}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="mt-3 p-3 bg-accent/10 rounded-lg">
                            <p className="text-xs font-medium text-accent mb-1">Explanation</p>
                            <p className="text-sm text-foreground">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => reattemptQuiz(reviewingAttempt)}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reattempt Quiz
                </Button>
                <Button variant="outline" onClick={() => {
                  if (reviewingAttempt.id === 'current') {
                    setGameState("results");
                  } else {
                    setGameState("history");
                  }
                }}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Playing State */}
          {gameState === "playing" && currentQuestion && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <Badge variant="outline" className="text-xs">{selectedSubject}</Badge>
                </div>
                <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="h-2" />
              </div>

              <Card className={`p-4 ${timerMode === 'timed' && timeLeft <= 10 ? "bg-destructive/10 border-destructive/50" : "bg-card"}`}>
                {timerMode === 'timed' ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className={`w-5 h-5 ${timeLeft <= 10 ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className={`text-2xl font-bold ${timeLeft <= 10 ? "text-destructive" : "text-foreground"}`}>
                        {timeLeft}s
                      </span>
                    </div>
                    <Badge variant="outline">{currentQuestion.points} pts</Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Untimed Mode</span>
                    <Badge variant="outline">{currentQuestion.points} pts</Badge>
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-card">
                <h3 className="text-xl font-semibold mb-6 text-foreground">{currentQuestion.question}</h3>
                 <RadioGroup value={selectedAnswer !== null ? selectedAnswer.toString() : ""} onValueChange={(val) => handleSelectAnswer(parseInt(val))}>
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedAnswer === index
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 bg-secondary"
                        }`}
                        onClick={() => handleSelectAnswer(index)}
                      >
                        <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-foreground">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </Card>

              {/* Question Navigator - showing answered questions */}
              <Card className="p-4 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">
                    Answered: {userSubmittedAnswers.filter(a => a !== null).length}/{questions.length}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {questions.map((_, idx) => (
                    <Button
                      key={idx}
                      variant={idx === currentQuestionIndex ? "default" : userSubmittedAnswers[idx] !== null ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleJumpToQuestion(idx)}
                    >
                      {idx + 1}
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Submit Quiz Button */}
              <Button size="lg" onClick={handleSubmitQuiz} className="w-full bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Submit Quiz
              </Button>
            </div>
          )}

          {/* Results State */}
          {gameState === "results" && (
            <div className="space-y-6">
              <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center ${getPerformanceRank().color}`}>
                  {getPerformanceRank().icon}
                </div>
                <h2 className="text-3xl font-bold mb-2 text-foreground">{getPerformanceRank().rank}</h2>
                <p className="text-muted-foreground mb-6">Challenge Complete!</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto mb-6">
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <Trophy className="w-6 h-6 mx-auto mb-2 text-accent" />
                    <p className="text-2xl font-bold text-foreground">{score}</p>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{correctAnswers}/{questions.length}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <Star className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{Math.round((correctAnswers / questions.length) * 100)}%</p>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                  </div>
                </div>

                {/* Show quiz code for AI-generated quizzes */}
                {!currentQuizId && !showQuizCode && (
                  <div className="mb-6 p-4 bg-accent/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">Want to share this quiz with others?</p>
                    <Button onClick={saveAIQuizAsShareable} disabled={isLoading} size="sm">
                      <Share2 className="w-4 h-4 mr-2" />
                      Generate & Share Code
                    </Button>
                  </div>
                )}

                {generatedQuizCode && (
                  <Dialog open={showQuizCode} onOpenChange={setShowQuizCode}>
                    <DialogTrigger asChild>
                      <div className="mb-6 p-4 bg-accent/10 rounded-lg">
                        <p className="text-sm font-mono font-bold text-accent mb-2">Quiz Code Generated!</p>
                        <div className="flex items-center gap-2 justify-center">
                          <code className="text-xl font-mono font-bold text-accent">{generatedQuizCode}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => shareQuiz(generatedQuizCode)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share Your Quiz</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Quiz Code</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 text-2xl font-mono font-bold text-accent p-4 bg-secondary rounded-lg text-center">
                              {generatedQuizCode}
                            </code>
                            <Button
                              onClick={() => shareQuiz(generatedQuizCode)}
                              variant="outline"
                              size="icon"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label>Share Link</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              readOnly
                              value={`${window.location.origin}/stem-challenge-arena?code=${generatedQuizCode}`}
                              className="text-sm"
                            />
                            <Button
                              onClick={() => shareQuiz(generatedQuizCode)}
                              variant="outline"
                              size="icon"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Share this code or link with others so they can take the same quiz!
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={() => {
                    // Set up review data for current quiz
                    setReviewingAttempt({
                      id: 'current',
                      quiz_id: currentQuizId || null,
                      score: score,
                      total_points: questions.reduce((sum, q) => sum + q.points, 0),
                      correct_answers: correctAnswers,
                      total_questions: questions.length,
                      subject: selectedSubject,
                      topic: selectedTopic || null,
                      completed_at: new Date().toISOString(),
                      answers: userSubmittedAnswers
                    });
                    setUserAnswers(userSubmittedAnswers);
                    setGameState("review");
                  }}>
                    <Eye className="w-4 h-4 mr-2" />
                    Review Answers
                  </Button>
                  <Button onClick={() => setGameState("setup")}>Play Again</Button>
                  <Button variant="outline" onClick={() => navigate("/leaderboard")}>
                    <Trophy className="w-4 h-4 mr-2" />
                    Leaderboard
                  </Button>
                  <Button variant="outline" onClick={() => setGameState("menu")}>Back to Menu</Button>
                </div>
              </Card>

              <Card className="p-6 bg-card">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Performance Breakdown</h3>
                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const userAnswer = userSubmittedAnswers[idx];
                    const wasAnswered = userAnswer !== null;
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                        isCorrect ? 'bg-primary/5 border border-primary/30' : 'bg-destructive/5 border border-destructive/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          {isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground line-clamp-1">Question {idx + 1}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{q.question}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{q.points} pts</Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Flashcards Setup State */}
          {gameState === "flashcards" && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Generate Flashcards
                </h3>

                <Tabs value={flashcardSource} onValueChange={(v) => setFlashcardSource(v as "topic" | "document")}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="topic">By Topic</TabsTrigger>
                    <TabsTrigger value="document">From Document</TabsTrigger>
                  </TabsList>

                  <TabsContent value="topic" className="space-y-4">
                    <div>
                      <Label>Subject *</Label>
                      <Select value={flashcardSubject} onValueChange={(v) => { setFlashcardSubject(v); setFlashcardTopic(""); }}>
                        <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map(s => (<SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(SUBJECTS.find(s => s.value === flashcardSubject)?.topics || []).length > 0 && (
                      <div>
                        <Label>Topic (Optional)</Label>
                        <Select value={flashcardTopic} onValueChange={setFlashcardTopic}>
                          <SelectTrigger><SelectValue placeholder="Select a topic" /></SelectTrigger>
                          <SelectContent>
                            {(SUBJECTS.find(s => s.value === flashcardSubject)?.topics || []).map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="document" className="space-y-4">
                    <div>
                      <Label>Upload Document (TXT, PDF, DOC, DOCX, JPG, PNG)</Label>
                      <Input type="file" accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFlashcardFileUpload} />
                    </div>
                    <div>
                      <Label>Or Paste Document Text</Label>
                      <Textarea
                        value={flashcardDocText}
                        onChange={(e) => setFlashcardDocText(e.target.value)}
                        placeholder="Paste your study material, notes, or textbook content here..."
                        className="min-h-[150px]"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-4">
                  <Label>Number of Flashcards</Label>
                  <Select value={flashcardCount.toString()} onValueChange={(v) => setFlashcardCount(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Cards</SelectItem>
                      <SelectItem value="15">15 Cards</SelectItem>
                      <SelectItem value="20">20 Cards</SelectItem>
                      <SelectItem value="30">30 Cards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Validation message */}
                {(flashcardSource === "topic" && !flashcardSubject) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mt-4">
                    ℹ️ Please select a subject to generate flashcards
                  </div>
                )}
                {(flashcardSource === "document" && !flashcardDocText.trim() && !flashcardFile) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mt-4">
                    ℹ️ Please upload a document or paste text to generate flashcards
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button 
                    onClick={generateFlashcards} 
                    disabled={isGeneratingFlashcards || (flashcardSource === "topic" && !flashcardSubject) || (flashcardSource === "document" && !flashcardDocText.trim() && !flashcardFile)}
                  >
                    {isGeneratingFlashcards ? (
                      <>
                        <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Flashcards
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setGameState("flashcard-decks")}>
                    <History className="w-4 h-4 mr-2" />
                    My Decks ({flashcardDecks.length})
                  </Button>
                  <Button variant="outline" onClick={() => setGameState("menu")}>Cancel</Button>
                </div>
              </Card>
            </div>
          )}

          {/* Flashcard View State */}
          {gameState === "flashcard-view" && generatedFlashcards.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Flashcards
                </h3>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] sm:text-xs">{currentCardIndex + 1} / {generatedFlashcards.length}</Badge>
                  <Button variant="outline" size="sm" className="text-xs h-8 sm:h-9" onClick={() => setGameState("flashcards")}>Back</Button>
                </div>
              </div>

              {/* Flashcard */}
              <div
                className="cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                 <Card className={`p-4 sm:p-8 min-h-[200px] sm:min-h-[240px] md:min-h-[280px] lg:min-h-[300px] flex items-center justify-center text-center transition-all duration-500 ${
                  isFlipped ? "bg-primary/5 border-primary/30" : "bg-card"
                }`}>
                  <div className="space-y-3 sm:space-y-4">
                    <Badge variant={isFlipped ? "default" : "outline"} className="mb-2 sm:mb-4 text-[9px] sm:text-xs">
                      {isFlipped ? "Answer" : "Question"}
                    </Badge>
                    <p className="text-base sm:text-lg md:text-xl font-medium text-foreground leading-relaxed">
                      {isFlipped ? generatedFlashcards[currentCardIndex].back : generatedFlashcards[currentCardIndex].front}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-4">
                      {isFlipped ? "Click to see question" : "Click to reveal answer"}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 sm:h-9"
                  onClick={() => { setCurrentCardIndex(Math.max(0, currentCardIndex - 1)); setIsFlipped(false); }}
                  disabled={currentCardIndex === 0}
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex gap-1 sm:gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-8 sm:h-9" onClick={() => setIsFlipped(!isFlipped)}>
                    <RotateCw className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Flip</span>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 sm:h-9"
                  onClick={() => { setCurrentCardIndex(Math.min(generatedFlashcards.length - 1, currentCardIndex + 1)); setIsFlipped(false); }}
                  disabled={currentCardIndex === generatedFlashcards.length - 1}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-0 sm:ml-1" />
                </Button>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-0.5 sm:gap-1 flex-wrap">
                {generatedFlashcards.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      idx === currentCardIndex ? "bg-primary" : "bg-muted"
                    }`}
                    onClick={() => { setCurrentCardIndex(idx); setIsFlipped(false); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Flashcard Decks State */}
          {gameState === "flashcard-decks" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  My Flashcard Decks
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setGameState("flashcards")}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Deck
                  </Button>
                  <Button variant="outline" onClick={() => setGameState("menu")}>Back</Button>
                </div>
              </div>

              {!user ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">Sign in to view your flashcard decks</p>
                  <Button onClick={() => navigate("/auth")}>Sign In</Button>
                </Card>
              ) : flashcardDecks.length === 0 ? (
                <Card className="p-6 text-center">
                  <Layers className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No flashcard decks yet. Generate your first deck!</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {flashcardDecks.map((deck) => (
                    <Card key={deck.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{deck.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{deck.subject}</Badge>
                            {deck.topic && <Badge variant="outline" className="text-xs">{deck.topic}</Badge>}
                            <span className="text-xs text-muted-foreground">{deck.total_cards} cards</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(deck.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => viewDeck(deck.id)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Study
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteDeck(deck.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
