import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MathRenderer } from "@/components/MathRenderer";
import { 
  ArrowLeft, Clock, Bookmark, ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, AlertCircle, HelpCircle, Send, RotateCcw, Flag, Sparkles, Loader2, FileText
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPastQuestions,
  startPastQuestionSession,
  recordQuestionResponse,
  completePastQuestionSession,
  togglePastQuestionBookmark,
  ensureCBTQuestionsForCollection,
} from "@/lib/pastQuestionsService";
import { PastQuestion, PastQuestionSession } from "@/types/pastQuestions";

export default function PastQuestionPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const examTypeId = searchParams.get("examTypeId") || "";
  const mode = (searchParams.get("mode") as "practice" | "timed_exam" | "topic_drill") || "practice";
  const subject = searchParams.get("subject") || undefined;
  const topic = searchParams.get("topic") || undefined;
  const section = searchParams.get("section") || undefined;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const institutionId = searchParams.get("institutionId") || undefined;
  const departmentId = searchParams.get("departmentId") || undefined;
  const academicLevel = searchParams.get("academicLevel") || undefined;
  const formatParam = searchParams.get("format") || undefined;
  const requestedCount = parseInt(searchParams.get("count") || "10");
  const customDurationParam = searchParams.get("duration") ? parseInt(searchParams.get("duration")!) : undefined;
  const shouldShuffle = searchParams.get("shuffle") === "true";
  // University hierarchy params
  const programmeId = searchParams.get("programmeId") || undefined;
  const examStructureId = searchParams.get("examStructureId") || undefined;
  const courseId = searchParams.get("courseId") || undefined;
  const collectionId = searchParams.get("collectionId") || undefined;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [session, setSession] = useState<PastQuestionSession | null>(null);

  // User selections: questionId -> selectedOptionId
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  // Theory responses: questionId -> student written answer
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  // Practice mode revealed explanations: questionId -> boolean
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  // Bookmarked status per question
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  // Timer states (for timed_exam)
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      setUser(authSession?.user ?? null);
      if (!authSession?.user) {
        toast.error("Please log in to start practicing");
        navigate("/auth");
        return;
      }
      initializeSession(authSession.user.id);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initializeSession = async (userId: string) => {
    try {
      setLoading(true);

      // Fetch matching questions
      let fetched: PastQuestion[] = [];
      if (collectionId) {
        fetched = await ensureCBTQuestionsForCollection(collectionId, examTypeId, requestedCount, userId, section);
      }

      if (fetched.length === 0) {
        fetched = await fetchPastQuestions(
          {
            examTypeId: examTypeId || undefined,
            institutionId,
            departmentId,
            academicLevel,
            subject,
            topic,
            year,
            questionFormat: (formatParam && formatParam !== "all") ? (formatParam as any) : undefined,
            programmeId,
            examStructureId,
            courseId,
            collectionId,
          },
          userId
        );
      }

      // STRICT: Never fall back to unrelated subjects. If collection or subject is specified, only match that subject.
      if (fetched.length === 0 && subject && !collectionId) {
        fetched = await fetchPastQuestions({ subject, examTypeId: examTypeId || undefined }, userId);
      }

      // Shuffle if requested
      let workingSet = [...fetched];
      if (shouldShuffle) {
        workingSet.sort(() => Math.random() - 0.5);
      }

      // Limit to requested count
      const sliced = workingSet.slice(0, requestedCount);
      if (sliced.length === 0) {
        toast.error("No questions found matching your criteria. Try different filters.");
        navigate("/past-questions");
        return;
      }

      setQuestions(sliced);

      // Initialize bookmarks map
      const bMap: Record<string, boolean> = {};
      sliced.forEach((q) => {
        bMap[q.id] = !!q.is_bookmarked;
      });
      setBookmarkedMap(bMap);

      // Duration: custom configured duration in minutes or default 2 mins per question
      const allocatedSeconds = mode === "timed_exam"
        ? (customDurationParam ? customDurationParam * 60 : sliced.length * 120)
        : 0;
      setTimeRemaining(allocatedSeconds);

      // Start session in database
      const newSession = await startPastQuestionSession({
        userId,
        sessionMode: mode,
        examTypeId: examTypeId || undefined,
        institutionId,
        subject: subject || sliced[0].subject,
        topic,
        year,
        totalQuestions: sliced.length,
        timeLimitSeconds: allocatedSeconds,
      });

      setSession(newSession);

      // Start countdown timer if timed exam
      if (mode === "timed_exam") {
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              handleFinalSubmit(true);
              return 0;
            }
            return prev - 1;
          });
          setTimeSpent((prev) => prev + 1);
        }, 1000);
      } else {
        // In practice mode, track elapsed time
        timerRef.current = setInterval(() => {
          setTimeSpent((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      console.error("Error initializing session:", err);
      toast.error("Failed to load practice session");
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = async (optionId: string) => {
    if (!currentQuestion || !session) return;

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));

    // Find if option is correct
    const chosenOption = currentQuestion.past_question_options?.find((o) => o.id === optionId);
    const isCorrect = chosenOption ? chosenOption.is_correct : false;

    // Auto-save response to Supabase
    try {
      await recordQuestionResponse({
        sessionId: session.id,
        questionId: currentQuestion.id,
        selectedOptionId: optionId,
        isCorrect,
        timeSpentSeconds: 5,
      });
    } catch (err) {
      console.error("Failed to auto-save answer:", err);
    }
  };

  const handleTheoryAnswerChange = (questionId: string, text: string) => {
    setTheoryAnswers((prev) => ({ ...prev, [questionId]: text }));
    if (text.trim()) {
      setSelectedAnswers((prev) => ({ ...prev, [questionId]: "theory-answered" }));
    } else {
      setSelectedAnswers((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleToggleBookmark = async () => {
    if (!currentQuestion || !user) return;
    const currentStatus = !!bookmarkedMap[currentQuestion.id];
    try {
      await togglePastQuestionBookmark(user.id, currentQuestion.id, currentStatus);
      setBookmarkedMap((prev) => ({
        ...prev,
        [currentQuestion.id]: !currentStatus,
      }));
      toast.success(!currentStatus ? "Question saved to bookmarks" : "Question removed from bookmarks");
    } catch {
      toast.error("Failed to update bookmark");
    }
  };

  const handleFinalSubmit = async (isAutoSubmit = false) => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitDialog(false);

    if (isAutoSubmit) {
      toast.warning("Time has expired! Submitting your examination...");
    } else {
      toast.loading("Submitting and calculating score...");
    }

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const completed = await completePastQuestionSession(session.id, timeSpent);
      toast.dismiss();
      if (completed) {
        toast.success("Examination submitted successfully!");
        navigate(`/past-questions/results/${completed.id}`);
      } else {
        navigate(`/past-questions`);
      }
    } catch (err) {
      console.error("Error submitting session:", err);
      toast.error("Failed to submit examination");
      setIsSubmitting(false);
    }
  };

  // Format timer seconds into mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;

  if (loading || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing question paper & CBT engine...</p>
        </div>
      </div>
    );
  }

  const isCurrentRevealed = revealedExplanations[currentQuestion.id];
  const selectedOptionForCurrent = selectedAnswers[currentQuestion.id];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/past-questions")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>{currentQuestion.subject}</span>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  {currentQuestion.exam_types?.code || "CBT"}
                </Badge>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Question {currentIndex + 1} of {questions.length} • {currentQuestion.year}
              </p>
            </div>
          </div>

          {/* Center Timer */}
          <div className="flex items-center gap-3">
            {mode === "timed_exam" ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-bold border transition-colors ${
                  timeRemaining < 300
                    ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse"
                    : "bg-secondary text-foreground border-border/60"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed: {formatTime(timeSpent)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleBookmark}
              className={`h-8 w-8 ${bookmarkedMap[currentQuestion.id] ? "text-accent fill-accent" : "text-muted-foreground"}`}
              title="Bookmark Question"
            >
              <Bookmark className={`w-4 h-4 ${bookmarkedMap[currentQuestion.id] ? "fill-current" : ""}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-8 px-3"
            >
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      {/* Main Examination Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Question & Options (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 sm:p-8 glass-card border-border/60 space-y-6">
            {/* Meta Tags */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {currentQuestion.paper_type || "Paper 1"}
                </Badge>
                {currentQuestion.topic && <span>Topic: {currentQuestion.topic}</span>}
              </div>
              <span className="font-semibold text-primary">{currentQuestion.points || 1} Point(s)</span>
            </div>

            {/* Question Text (LaTeX & Markdown rendered) */}
            <div className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
              <MathRenderer content={currentQuestion.question_text} />
            </div>

            {/* Optional Diagram Illustration */}
            {currentQuestion.diagram_url && (
              <div className="rounded-xl overflow-hidden border border-border/50 max-w-md mx-auto p-2 bg-secondary/30">
                <img
                  src={currentQuestion.diagram_url}
                  alt="Question Diagram"
                  className="w-full h-auto object-contain max-h-64 rounded-lg"
                />
              </div>
            )}

            {/* Question Body: Theory Written Response OR MCQ Options */}
            {currentQuestion.question_format === "theory" ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Written Working & Candidate Solution:
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {currentQuestion.points || 5} Points
                  </Badge>
                </div>
                <Textarea
                  value={theoryAnswers[currentQuestion.id] || ""}
                  onChange={(e) => handleTheoryAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Write your complete derivation, formula substitutions, working steps, and final answer here..."
                  className="min-h-[160px] text-sm bg-secondary/30 border-border/60 font-mono leading-relaxed p-4"
                />
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {currentQuestion.past_question_options?.map((option) => {
                  const isSelected = selectedOptionForCurrent === option.id;
                  let optionStyle = "glass-card border-border/60 hover:border-primary/40 text-foreground";

                  // In practice mode after revealing: color-code correct/incorrect
                  if (mode === "practice" && isCurrentRevealed) {
                    if (option.is_correct) {
                      optionStyle = "bg-primary/15 border-primary text-primary font-semibold";
                    } else if (isSelected && !option.is_correct) {
                      optionStyle = "bg-destructive/15 border-destructive text-destructive";
                    }
                  } else if (isSelected) {
                    optionStyle = "bg-primary/15 border-primary text-primary font-semibold shadow-glow";
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(option.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${optionStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground border border-border/50"
                        }`}
                      >
                        {option.option_letter}
                      </span>
                      <div className="flex-1 pt-0.5 text-sm sm:text-base">
                        <MathRenderer content={option.option_text} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Practice Mode: Reveal Solution Controls */}
            {mode === "practice" && (
              <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRevealedExplanations((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !isCurrentRevealed,
                    }))
                  }
                  className="gap-2 text-xs border-border/60"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-accent" />
                  {isCurrentRevealed ? "Hide Solution" : "Explain & Show Answer"}
                </Button>
              </div>
            )}

            {/* Step-by-step Solution Accordion / Card */}
            {isCurrentRevealed && (currentQuestion.model_answer || currentQuestion.explanation) && (
              <div className="p-4 sm:p-5 rounded-xl bg-secondary/60 border border-primary/20 space-y-2.5 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-xs font-bold text-accent">
                  <Sparkles className="w-3.5 h-3.5" />
                  {currentQuestion.question_format === "theory"
                    ? "Official Model Answer & Marking Scheme:"
                    : "Step-by-Step Explanation & Working:"}
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed">
                  <MathRenderer content={currentQuestion.model_answer || currentQuestion.explanation || ""} />
                </div>
              </div>
            )}
          </Card>

          {/* Navigation Controls (Previous / Next) */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="gap-2 border-border/60 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="text-xs text-muted-foreground font-medium">
              {currentIndex + 1} of {questions.length}
            </div>

            {currentIndex < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              >
                Next Question
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => setShowSubmitDialog(true)}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs"
              >
                Finish & Submit
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: CBT Question Palette Navigator (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 glass-card border-border/60 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-bold text-sm text-foreground">Question Navigator</h3>
              <Badge variant="outline" className="text-xs font-mono">
                {answeredCount}/{questions.length} Answered
              </Badge>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-secondary border border-border" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded ring-2 ring-primary bg-primary/20" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <Bookmark className="w-3 h-3 text-accent fill-accent" />
                <span>Bookmarked</span>
              </div>
            </div>

            {/* Palette Grid */}
            <div className="grid grid-cols-5 gap-2 pt-2 max-h-72 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isAnswered = !!selectedAnswers[q.id];
                const isCurrent = idx === currentIndex;
                const isBookmarked = !!bookmarkedMap[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold relative transition-all flex items-center justify-center ${
                      isCurrent
                        ? "ring-2 ring-primary bg-primary/20 text-foreground shadow-glow"
                        : isAnswered
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border/40"
                    }`}
                  >
                    {idx + 1}
                    {isBookmarked && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Submit Button */}
            <div className="pt-3 border-t border-border/40">
              <Button
                onClick={() => setShowSubmitDialog(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9"
              >
                Submit All Answers
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Final Submit Confirmation Modal */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="glass-card border-border/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Submit Examination Session?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Please verify your progress before completing this session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-center">
              <span className="text-2xl font-extrabold text-primary">{answeredCount}</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Questions Answered</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-center">
              <span className="text-2xl font-extrabold text-muted-foreground">{unansweredCount}</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Unanswered</p>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                You have {unansweredCount} unanswered question(s). Unanswered questions will be scored as 0.
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              className="border-border/60 text-xs"
            >
              Continue Practicing
            </Button>
            <Button
              onClick={() => handleFinalSubmit(false)}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Yes, Submit Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

