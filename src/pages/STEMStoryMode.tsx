import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, BookOpen, Star, Lock, CheckCircle2, Play, Award, Sparkles,
  ChevronRight, ChevronLeft, Brain, Globe, Beaker, Calculator, Cpu,
  Lightbulb, Loader2, RefreshCw, Zap, BookMarked, Trophy, ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import storyHeroImg from "@/assets/story-hero.jpg";
import anansiImg from "@/assets/story-anansi-math.jpg";
import blacksmithImg from "@/assets/story-blacksmith-heat.jpg";
import healerImg from "@/assets/story-healer-chemistry.jpg";
import starNavImg from "@/assets/story-star-navigators.jpg";
import dashboardHeroImg from "@/assets/dashboard-stem-hero.jpg";

// ── Preset stories ──
const presetStories = [
  {
    id: "preset-1",
    title: "Anansi and the Web of Mathematics",
    subtitle: "Where folklore meets geometry",
    culturalContext: "West African Folklore",
    category: "Mathematics",
    difficulty: "Beginner" as const,
    points: 100,
    icon: <Calculator className="w-5 h-5" />,
    gradient: "from-purple-500/20 to-blue-500/20",
    accentColor: "text-purple-400",
    image: anansiImg,
  },
  {
    id: "preset-2",
    title: "The Blacksmith's Secret of Heat",
    subtitle: "Ancient metallurgy meets modern physics",
    culturalContext: "Yoruba Craftsmanship",
    category: "Physics",
    difficulty: "Intermediate" as const,
    points: 150,
    icon: <Beaker className="w-5 h-5" />,
    gradient: "from-orange-500/20 to-red-500/20",
    accentColor: "text-orange-400",
    image: blacksmithImg,
  },
  {
    id: "preset-3",
    title: "The Healer's Garden of Chemistry",
    subtitle: "Traditional medicine through a molecular lens",
    culturalContext: "Igbo Herbal Medicine",
    category: "Chemistry",
    difficulty: "Intermediate" as const,
    points: 150,
    icon: <Brain className="w-5 h-5" />,
    gradient: "from-green-500/20 to-emerald-500/20",
    accentColor: "text-green-400",
    image: healerImg,
  },
  {
    id: "preset-4",
    title: "The Star Navigators",
    subtitle: "Celestial wisdom of Saharan traders",
    culturalContext: "Hausa Navigation",
    category: "Astronomy",
    difficulty: "Advanced" as const,
    points: 200,
    icon: <Globe className="w-5 h-5" />,
    gradient: "from-blue-500/20 to-indigo-500/20",
    accentColor: "text-blue-400",
    image: starNavImg,
  },
];

const cultures = [
  "Yoruba", "Igbo", "Hausa", "Zulu", "Maasai", "Akan", "Swahili",
  "Amhara", "Berber", "San", "Fulani", "Wolof", "Shona"
];
const subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "Astronomy", "Engineering", "Technology", "Environmental Science"];
const difficulties = ["Beginner", "Intermediate", "Advanced"];

interface GeneratedStory {
  title: string;
  subtitle: string;
  culturalContext: string;
  introduction: string;
  pages: string[];
  imagePrompts?: string[];
  stemConcept: string;
  culturalTieIn: string;
  quiz: { question: string; options: string[]; correctAnswer: number; explanation: string }[];
  funFact: string;
}

type ViewState = "library" | "generator" | "reading" | "quiz" | "results";

export default function STEMStoryMode() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>("library");
  const [totalPoints, setTotalPoints] = useState(0);
  const [completedStories, setCompletedStories] = useState<string[]>([]);

  // Generator state
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("Intermediate");
  const [customTopic, setCustomTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Reading state
  const [currentStory, setCurrentStory] = useState<GeneratedStory | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<{ correct: boolean; selected: number }[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);

  // Generate image for a specific page
  const generatePageImage = useCallback(async (pageIdx: number, story: GeneratedStory) => {
    if (pageImages[pageIdx] || loadingImages[pageIdx]) return;
    const prompt = story.imagePrompts?.[pageIdx] || `Scene from "${story.title}" - page ${pageIdx + 1}, ${story.culturalContext} setting`;
    
    setLoadingImages(prev => ({ ...prev, [pageIdx]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-story-image", {
        body: { prompt, storyTitle: story.title, pageIndex: pageIdx },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        setPageImages(prev => ({ ...prev, [pageIdx]: data.imageUrl }));
      }
    } catch (err) {
      console.error("Failed to generate image for page", pageIdx, err);
    } finally {
      setLoadingImages(prev => ({ ...prev, [pageIdx]: false }));
    }
  }, [pageImages, loadingImages]);

  // Auto-generate image for current page
  useEffect(() => {
    if (view === "reading" && currentStory && !isGenerating) {
      generatePageImage(currentPage, currentStory);
      // Preload next page image
      if (currentPage < currentStory.pages.length - 1) {
        generatePageImage(currentPage + 1, currentStory);
      }
    }
  }, [view, currentPage, currentStory, isGenerating]);

  // ── Generate AI Story ──
  const handleGenerateStory = async () => {
    if (!selectedSubject) { toast.error("Please select a STEM subject"); return; }
    if (!selectedCulture) { toast.error("Please select a cultural setting"); return; }

    setIsGenerating(true);
    setPageImages({});
    try {
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: {
          topic: customTopic || `${selectedSubject} concepts`,
          culture: selectedCulture,
          subject: selectedSubject,
          difficulty: selectedDifficulty,
        },
      });
      if (error) throw error;
      setCurrentStory(data.story);
      setCurrentPage(0);
      setView("reading");
      toast.success("Your story is ready!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate story");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadPreset = async (preset: typeof presetStories[0]) => {
    setIsGenerating(true);
    setPageImages({});
    setView("reading");
    try {
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: {
          topic: preset.title,
          culture: preset.culturalContext,
          subject: preset.category,
          difficulty: preset.difficulty,
        },
      });
      if (error) throw error;
      setCurrentStory(data.story);
      setCurrentPage(0);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load story");
      setView("library");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextPage = () => {
    if (!currentStory) return;
    if (currentPage < currentStory.pages.length - 1) {
      setCurrentPage(p => p + 1);
    } else {
      setQuizIndex(0);
      setSelectedAnswer(null);
      setAnsweredQuestions([]);
      setShowExplanation(false);
      setView("quiz");
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(p => p - 1);
  };

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null || !currentStory) return;
    const correct = selectedAnswer === currentStory.quiz[quizIndex].correctAnswer;
    setAnsweredQuestions([...answeredQuestions, { correct, selected: selectedAnswer }]);
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (!currentStory) return;
    if (quizIndex < currentStory.quiz.length - 1) {
      setQuizIndex(i => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      const correctCount = [...answeredQuestions].filter(a => a.correct).length;
      const earned = correctCount * 50;
      setTotalPoints(p => p + earned);
      setView("results");
    }
  };

  const correctCount = answeredQuestions.filter(a => a.correct).length;

  const difficultyColor = (d: string) =>
    d === "Beginner" ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" :
    d === "Intermediate" ? "border-amber-500/50 text-amber-400 bg-amber-500/10" :
    "border-rose-500/50 text-rose-400 bg-rose-500/10";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => view === "library" ? navigate("/dashboard") : setView("library")} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-primary" />
                STEM Story Mode
              </h1>
              <p className="text-xs text-muted-foreground">AI-powered African STEM narratives</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-full">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-accent">{totalPoints}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* ── LIBRARY VIEW ── */}
        {view === "library" && (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
            {/* Hero banner with image */}
            <div className="relative rounded-2xl overflow-hidden">
              <img src={storyHeroImg} alt="STEM Story Mode" className="w-full h-40 sm:h-64 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-3">
                  <Sparkles className="w-4 h-4" />
                  AI-Powered Stories
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Learn STEM Through African Stories</h2>
                <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                  Explore science and mathematics woven into rich cultural narratives — or generate your own unique story with AI.
                </p>
              </div>
            </div>

            {/* AI Story Generator CTA */}
            <Card
              className="p-6 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 cursor-pointer hover:border-primary/60 transition-all group"
              onClick={() => setView("generator")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Create Your Own Story</h3>
                    <p className="text-sm text-muted-foreground">Choose a culture, subject, and topic — AI crafts a unique story with illustrations</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>

            {/* Featured Stories with images */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Featured Stories
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {presetStories.map((story) => {
                  const completed = completedStories.includes(story.id);
                  return (
                    <Card
                      key={story.id}
                      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-all group border-border/50"
                      onClick={() => handleLoadPreset(story)}
                    >
                      <div className="relative h-36 sm:h-44 overflow-hidden">
                        <img
                          src={story.image}
                          alt={story.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-card/70">{story.category}</Badge>
                          <Badge variant="outline" className={`text-xs backdrop-blur-sm bg-card/70 ${difficultyColor(story.difficulty)}`}>{story.difficulty}</Badge>
                        </div>
                        {completed && (
                          <div className="absolute top-3 left-3">
                            <CheckCircle2 className="w-6 h-6 text-primary drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{story.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{story.subtitle}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">{story.culturalContext}</span>
                          <span className="text-xs text-accent flex items-center gap-1"><Award className="w-3 h-3" />{story.points} pts</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Dashboard-style motivation section */}
            <div className="relative rounded-2xl overflow-hidden">
              <img src={dashboardHeroImg} alt="STEM Learning" className="w-full h-32 sm:h-40 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent flex items-center">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-foreground">Your Learning Journey</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {completedStories.length} stories completed · {totalPoints} points earned
                  </p>
                  <div className="flex gap-3 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {presetStories.length} Featured
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      ∞ AI Generated
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GENERATOR VIEW ── */}
        {view === "generator" && (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            <div className="text-center space-y-2">
              <Sparkles className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">AI Story Generator</h2>
              <p className="text-sm text-muted-foreground">Customize your learning adventure with AI-generated illustrations</p>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">STEM Subject *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSubject(s)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      selectedSubject === s
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-card border-border/50 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Culture */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cultural Setting *</label>
              <div className="flex flex-wrap gap-2">
                {cultures.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCulture(c)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                      selectedCulture === c
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-card border-border/50 text-muted-foreground hover:border-accent/50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Difficulty</label>
              <div className="flex gap-2">
                {difficulties.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(d)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      selectedDifficulty === d
                        ? `${difficultyColor(d)} border-current`
                        : "bg-card border-border/50 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom topic */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Specific Topic (optional)</label>
              <input
                type="text"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder="e.g., Fibonacci sequence, DNA replication, Solar energy..."
                className="w-full px-4 py-3 rounded-xl bg-card border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <Button onClick={handleGenerateStory} disabled={isGenerating} className="w-full h-12 text-base font-semibold rounded-xl">
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crafting your story...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Generate Story with Illustrations</>
              )}
            </Button>
          </div>
        )}

        {/* ── READING VIEW ── */}
        {view === "reading" && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <p className="text-foreground font-medium">AI is crafting your story...</p>
                <p className="text-sm text-muted-foreground">Generating narrative and illustrations</p>
              </div>
            ) : currentStory ? (
              <div className="space-y-6">
                {/* Story header */}
                <div className="text-center space-y-2">
                  <Badge variant="secondary" className="mb-2">{currentStory.culturalContext}</Badge>
                  <h2 className="text-2xl font-bold text-foreground">{currentStory.title}</h2>
                  <p className="text-sm text-muted-foreground italic">{currentStory.subtitle}</p>
                </div>

                {/* Page illustration */}
                <div className="relative rounded-xl overflow-hidden bg-muted aspect-[16/9]">
                  {pageImages[currentPage] ? (
                    <img
                      src={pageImages[currentPage]}
                      alt={`Illustration for page ${currentPage + 1}`}
                      className="w-full h-full object-cover animate-in fade-in duration-500"
                    />
                  ) : loadingImages[currentPage] ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">Generating illustration...</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                      <button
                        onClick={() => generatePageImage(currentPage, currentStory)}
                        className="text-xs text-primary hover:underline"
                      >
                        Generate illustration
                      </button>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-muted-foreground">
                    Page {currentPage + 1} of {currentStory.pages.length}
                  </div>
                </div>

                {/* Introduction (page 0 only) */}
                {currentPage === 0 && (
                  <Card className="p-5 bg-primary/5 border-primary/20">
                    <p className="text-foreground italic leading-relaxed">{currentStory.introduction}</p>
                  </Card>
                )}

                {/* Story content */}
                <Card className="p-6 bg-card border-border/50">
                  <p className="text-foreground leading-relaxed text-[15px] whitespace-pre-line">
                    {currentStory.pages[currentPage]}
                  </p>
                </Card>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Page {currentPage + 1} of {currentStory.pages.length}</span>
                    <span>{Math.round(((currentPage + 1) / currentStory.pages.length) * 100)}%</span>
                  </div>
                  <Progress value={((currentPage + 1) / currentStory.pages.length) * 100} className="h-1.5" />
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={handlePrevPage} disabled={currentPage === 0} className="rounded-xl">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button onClick={handleNextPage} className="rounded-xl">
                    {currentPage < currentStory.pages.length - 1 ? (
                      <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>Take Quiz <Brain className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>

                {/* STEM & Cultural info (last page) */}
                {currentPage === currentStory.pages.length - 1 && (
                  <div className="space-y-4 pt-2">
                    <Card className="p-5 bg-primary/5 border-primary/20">
                      <h4 className="font-semibold text-primary mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> The Science Behind It</h4>
                      <p className="text-foreground text-sm leading-relaxed">{currentStory.stemConcept}</p>
                    </Card>
                    <Card className="p-5 bg-accent/5 border-accent/20">
                      <h4 className="font-semibold text-accent mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Cultural Heritage</h4>
                      <p className="text-foreground text-sm leading-relaxed">{currentStory.culturalTieIn}</p>
                    </Card>
                    {currentStory.funFact && (
                      <Card className="p-4 bg-secondary border-border/50">
                        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">💡 Fun Fact:</span> {currentStory.funFact}</p>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── QUIZ VIEW ── */}
        {view === "quiz" && currentStory && (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            <div className="text-center space-y-2">
              <Brain className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Test Your Knowledge</h2>
              <p className="text-sm text-muted-foreground">Question {quizIndex + 1} of {currentStory.quiz.length}</p>
            </div>

            <Progress value={((quizIndex + 1) / currentStory.quiz.length) * 100} className="h-1.5" />

            <Card className="p-6 bg-card border-border/50">
              <p className="text-foreground font-medium text-lg mb-5">{currentStory.quiz[quizIndex].question}</p>
              <div className="space-y-3">
                {currentStory.quiz[quizIndex].options.map((opt, i) => {
                  const answered = showExplanation;
                  const isCorrect = i === currentStory.quiz[quizIndex].correctAnswer;
                  const isSelected = selectedAnswer === i;

                  let styles = "border-border/50 bg-secondary hover:border-primary/50";
                  if (answered && isCorrect) styles = "border-emerald-500 bg-emerald-500/10";
                  else if (answered && isSelected && !isCorrect) styles = "border-rose-500 bg-rose-500/10";
                  else if (!answered && isSelected) styles = "border-primary bg-primary/10";

                  return (
                    <button
                      key={i}
                      disabled={answered}
                      onClick={() => setSelectedAnswer(i)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${styles}`}
                    >
                      <span className="text-foreground text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-primary">Explanation:</span> {currentStory.quiz[quizIndex].explanation}
                  </p>
                </Card>
              )}
            </Card>

            {!showExplanation ? (
              <Button onClick={handleAnswerSubmit} disabled={selectedAnswer === null} className="w-full h-12 rounded-xl text-base">
                Submit Answer
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} className="w-full h-12 rounded-xl text-base">
                {quizIndex < currentStory.quiz.length - 1 ? "Next Question" : "See Results"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === "results" && currentStory && (
          <div className="max-w-lg mx-auto px-4 py-10 space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
              <Trophy className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Story Complete!</h2>
            <p className="text-muted-foreground">"{currentStory.title}"</p>

            <Card className="p-6 bg-card border-border/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-primary">{correctCount}/{currentStory.quiz.length}</p>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">+{correctCount * 50}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{Math.round((correctCount / currentStory.quiz.length) * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setView("library"); setCurrentStory(null); setPageImages({}); }} className="flex-1 rounded-xl">
                <BookOpen className="w-4 h-4 mr-2" /> More Stories
              </Button>
              <Button onClick={() => { setView("generator"); setCurrentStory(null); setPageImages({}); }} className="flex-1 rounded-xl">
                <Sparkles className="w-4 h-4 mr-2" /> New Story
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
