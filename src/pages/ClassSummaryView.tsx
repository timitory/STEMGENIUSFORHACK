import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlayCircle, Calendar, Clock, Users, ArrowLeft, Download,
  Share2, CheckCircle2, HelpCircle, ExternalLink, FileText, Sparkles, Loader2, ThumbsUp
} from "lucide-react";
import { toast } from "sonner";
import { fetchClassByRoomId, fetchClassQA } from "@/lib/virtualClassService";
import { VirtualClass, ClassRecording, ClassQAItem } from "@/types/virtualClasses";

export default function ClassSummaryView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [recording, setRecording] = useState<ClassRecording | null>(null);
  const [qaItems, setQaItems] = useState<ClassQAItem[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      loadSummary(session.user.id);
    });
  }, [roomId, navigate]);

  const loadSummary = async (userId: string) => {
    if (!roomId) return;
    try {
      setLoading(true);
      const [profileRes, cls] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        fetchClassByRoomId(roomId, userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      if (!cls) {
        toast.error("Class summary not found");
        navigate("/virtual-classes");
        return;
      }

      setVirtualClass(cls);

      // Load QA
      const qa = await fetchClassQA(cls.id);
      setQaItems(qa);

      // Fetch recording if attached
      const { data: recData } = await supabase
        .from("class_recordings")
        .select("*")
        .eq("class_id", cls.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recData) {
        setRecording(recData as unknown as ClassRecording);
      }
    } catch (err) {
      console.error("Error loading summary:", err);
      toast.error("Failed to load class summary");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Summary & recording link copied to clipboard!");
  };

  if (loading || !virtualClass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Class Summary & Recording...</p>
        </div>
      </div>
    );
  }

  const answeredQA = qaItems.filter((q) => q.is_answered);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Back Navigation & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/virtual-classes")}
            className="text-muted-foreground hover:text-foreground text-xs gap-1.5 w-fit p-0 h-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Virtual Classes Hub
          </Button>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-semibold">
              ● Class Concluded
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="text-xs h-8 gap-1.5 border-border/60"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Summary
            </Button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              {virtualClass.subject}
            </Badge>
            {virtualClass.topic && (
              <Badge variant="secondary" className="text-xs">
                {virtualClass.topic}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {virtualClass.title}
          </h1>

          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {virtualClass.description ||
              "Comprehensive review lecture covering past examination techniques, problem-solving breakdowns, and student Q&A."}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <span>Host: <strong className="text-foreground">{virtualClass.host?.name || "Verified Educator"}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-accent" />
              <span>Concluded: {new Date(virtualClass.scheduled_start).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Duration: {virtualClass.duration_minutes} Minutes</span>
            </div>
          </div>
        </div>

        {/* Video Player Card */}
        <Card className="glass-card border-border/60 overflow-hidden shadow-2xl">
          <div className="aspect-video w-full bg-black relative flex items-center justify-center">
            {recording && recording.video_url ? (
              <video
                src={recording.video_url}
                controls
                poster={recording.thumbnail_url || undefined}
                className="w-full h-full object-contain"
              >
                Your browser does not support high-definition video streaming.
              </video>
            ) : (
              <div className="text-center space-y-3 p-6">
                <PlayCircle className="w-16 h-16 text-primary/40 mx-auto" />
                <h3 className="text-base font-bold text-foreground">Video Processing In Progress</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  The host recently ended this live session. Cloud encoders are rendering the composite 1080p stream. Please refresh in a moment.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/60">
            <div>
              <h3 className="font-bold text-base text-foreground">
                {recording?.recording_title || "Session Recording"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Composite recording includes whiteboard drawings, host webcam, and speaker audio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {recording?.zoom_share_url && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="text-xs h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <a href={recording.zoom_share_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Zoom Cloud
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (recording?.video_url) {
                    window.open(recording.video_url, "_blank");
                  } else {
                    toast.info("Recording file is compiling.");
                  }
                }}
                className="text-xs h-9 gap-1.5 border-border/60"
              >
                <Download className="w-4 h-4" />
                Download Video
              </Button>
            </div>
          </div>
        </Card>

        {/* Two-Column Grid: Resources & Q&A Recap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Presentation Materials & Notes */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Presentation Slides & Attachments
            </h3>

            <Card className="p-5 glass-card border-border/60 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    Masterclass Lecture Slides (PDF)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Includes all handwritten formula derivations and past question solutions.
                  </p>
                </div>
                {virtualClass.presentation_slides_url && (
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                    PDF Attached
                  </Badge>
                )}
              </div>

              <Button
                size="sm"
                variant="secondary"
                disabled={!virtualClass.presentation_slides_url}
                onClick={() => {
                  if (virtualClass.presentation_slides_url) {
                    toast.success("Opening class resources...");
                    window.open(virtualClass.presentation_slides_url, "_blank");
                  } else {
                    toast.info("No resource attachment was uploaded for this session.");
                  }
                }}
                className="w-full text-xs h-9 gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                {virtualClass.presentation_slides_url ? "Download Class Materials (PDF)" : "No Materials Attached"}
              </Button>
            </Card>

            {/* Host Notes */}
            {virtualClass.host_announcements && (
              <Card className="p-5 glass-card border-border/60 space-y-2 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Educator Post-Class Notes
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {virtualClass.host_announcements}
                </p>
              </Card>
            )}
          </div>

          {/* Column 2: Session Q&A Recap */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-accent" />
              Key Q&A Highlights ({answeredQA.length})
            </h3>

            {answeredQA.length === 0 ? (
              <Card className="p-8 text-center glass-card border-border/60">
                <HelpCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No written questions were logged during this session.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {answeredQA.map((q) => (
                  <Card key={q.id} className="p-4 glass-card border-border/60 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        Q: {q.question_text}
                      </p>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <ThumbsUp className="w-3 h-3 text-primary" />
                        {q.upvotes_count}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-secondary/80 border border-border/40 text-xs text-muted-foreground space-y-1">
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Answered by {q.answered_by || "Host"}:
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed">{q.answer_text}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

