import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MathRenderer } from "@/components/MathRenderer";
import { 
  Trophy, CheckCircle2, XCircle, Clock, RotateCcw, ArrowRight, 
  BookOpen, Sparkles, AlertTriangle, Target, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { getSessionDetails } from "@/lib/pastQuestionsService";
import { PastQuestionSession, PastQuestionResponse } from "@/types/pastQuestions";

export default function PastQuestionResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PastQuestionSession | null>(null);
  const [responses, setResponses] = useState<PastQuestionResponse[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionId) {
      navigate("/past-questions");
      return;
    }

    loadSessionData(sessionId);
  }, [sessionId]);

  const loadSessionData = async (id: string) => {
    try {
      setLoading(true);
      const data = await getSessionDetails(id);
      if (!data || !data.session) {
        toast.error("Session results not found");
        navigate("/past-questions");
        return;
      }
      setSession(data.session);
      setResponses(data.responses);

      // Expand first 2 questions by default for quick inspection
      const initialExpanded: Record<string, boolean> = {};
      data.responses.slice(0, 2).forEach((r) => {
        initialExpanded[r.question_id] = true;
      });
      setExpandedQuestions(initialExpanded);
    } catch (err) {
      console.error("Failed to load results:", err);
      toast.error("Error loading results");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (questionId: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Calculating your score & performance metrics...</p>
        </div>
      </div>
    );
  }

  // Calculate topic performance breakdown
  const topicStats: Record<string, { total: number; correct: number }> = {};
  responses.forEach((r) => {
    const topicName = r.past_questions?.topic || "General";
    if (!topicStats[topicName]) {
      topicStats[topicName] = { total: 0, correct: 0 };
    }
    topicStats[topicName].total += 1;
    if (r.is_correct) topicStats[topicName].correct += 1;
  });

  const weakTopics = Object.entries(topicStats)
    .filter(([_, stats]) => (stats.correct / stats.total) < 0.6)
    .map(([name, stats]) => ({
      name,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder}s`;
  };

  const accuracy = session.accuracy_percentage ?? 0;
  const isPass = accuracy >= 50;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Hero Score Card */}
        <Card className="p-6 sm:p-10 glass-card border-border/80 text-center relative overflow-hidden">
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto text-primary glow-primary">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <Badge variant="outline" className="mb-2 uppercase text-xs tracking-wider">
                {session.exam_types?.name || "Exam Session"} • {session.subject}
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
                {isPass ? "Great Work! 🎉" : "Session Completed 📚"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isPass
                  ? "You demonstrated strong grasp of key examination concepts."
                  : "Keep practicing! Review your weak topics below to boost your exam score."}
              </p>
            </div>

            {/* Main Score Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-2xl sm:text-3xl font-extrabold text-primary">{accuracy}%</span>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold mt-1">
                  Accuracy
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {session.correct_answers}/{session.total_questions}
                </span>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold mt-1">
                  Correct
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-2xl sm:text-3xl font-extrabold text-accent">
                  {session.score}
                </span>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold mt-1">
                  Points Earned
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-2xl sm:text-3xl font-extrabold text-chart-3 font-mono">
                  {formatSeconds(session.time_spent_seconds)}
                </span>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold mt-1">
                  Time Spent
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Button
                onClick={() => navigate("/past-questions")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2"
              >
                Back to Exam Hub
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/past-questions/practice?examTypeId=${session.exam_type_id}&subject=${session.subject}&mode=${session.session_mode}`
                  )
                }
                className="border-border/60 text-xs gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retake Exam
              </Button>
            </div>
          </div>
        </Card>

        {/* Weak Topics & Revision Recommendations */}
        {weakTopics.length > 0 && (
          <Card className="p-6 glass-card border-accent/30 space-y-4">
            <div className="flex items-center gap-2.5 text-accent">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-bold text-foreground">
                Recommended Focus Areas for Revision
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on your answers, these topics need targeted revision to improve your performance:
            </p>

            <div className="space-y-3 pt-1">
              {weakTopics.map((topic) => (
                <div key={topic.name} className="p-3 rounded-lg bg-secondary/40 border border-border/40 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{topic.name}</span>
                    <span className="text-muted-foreground font-mono">{topic.percentage}% Mastery</span>
                  </div>
                  <Progress value={topic.percentage} className="h-1.5 bg-secondary" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Question-by-Question Detailed Review */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Detailed Question Review</h2>
            <span className="text-xs text-muted-foreground">{responses.length} Questions Answered</span>
          </div>

          <div className="space-y-3">
            {responses.map((resp, idx) => {
              const q = resp.past_questions;
              if (!q) return null;

              const isExpanded = !!expandedQuestions[q.id];
              const isCorrect = resp.is_correct;
              const options = q.past_question_options || [];

              return (
                <Card key={resp.id} className="glass-card border-border/60 overflow-hidden">
                  {/* Collapsed Header */}
                  <div
                    onClick={() => toggleExpand(q.id)}
                    className="p-4 cursor-pointer flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCorrect
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-destructive/20 text-destructive border border-destructive/30"
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">
                          Question {idx + 1}
                        </span>
                        {q.topic && (
                          <span className="text-[11px] text-muted-foreground ml-2">
                            • {q.topic}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold ${
                          isCorrect ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {isCorrect ? "+1 Point" : "0 Points"}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Solution View */}
                  {isExpanded && (
                    <div className="p-5 border-t border-border/40 bg-secondary/10 space-y-4">
                      {/* Question Text */}
                      <div className="text-sm font-medium text-foreground">
                        <MathRenderer content={q.question_text} />
                      </div>

                      {/* Options with student pick vs correct pick */}
                      <div className="space-y-2 pt-1">
                        {options.map((opt) => {
                          const isStudentPick = resp.selected_option_id === opt.id;
                          const isActualCorrect = opt.is_correct;

                          let badgeColor = "border-border/40 text-muted-foreground";
                          if (isActualCorrect) {
                            badgeColor = "bg-primary/15 border-primary text-primary font-semibold";
                          } else if (isStudentPick && !isActualCorrect) {
                            badgeColor = "bg-destructive/15 border-destructive text-destructive font-semibold";
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${badgeColor}`}
                            >
                              <span className="font-bold uppercase shrink-0">
                                {opt.option_letter}.
                              </span>
                              <div className="flex-1">
                                <MathRenderer content={opt.option_text} />
                              </div>
                              {isActualCorrect && (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/40 shrink-0">
                                  Correct Answer
                                </Badge>
                              )}
                              {isStudentPick && !isActualCorrect && (
                                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 shrink-0">
                                  Your Choice
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="p-3.5 rounded-xl bg-secondary/50 border border-primary/20 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                            <Sparkles className="w-3.5 h-3.5" />
                            Solution & Working:
                          </div>
                          <div className="text-xs text-foreground/90 leading-relaxed">
                            <MathRenderer content={q.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

