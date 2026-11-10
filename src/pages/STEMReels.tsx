import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { notifyReelLike } from "@/lib/notifications";
import { Heart, MessageCircle, Share2, Play, Pause, Upload, Video, Radio, Download, ArrowLeft, ChevronUp, ChevronDown, Eye, Plus, Music, Loader2, Volume2, VolumeX, Bookmark, MoreHorizontal, Verified, AlertCircle, Search } from "lucide-react";
import { CameraRecorder } from "@/components/reels/CameraRecorder";
import { CommentSection } from "@/components/reels/CommentSection";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFeatureAuth } from "@/hooks/useFeatureAuth";

// Direct upload limits (No client-side re-encoding or compression to prevent video lag & audio desync)
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB practical web upload limit

interface Reel {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  created_at: string | null;
  profiles?: { name: string };
}

const STEMReels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const targetReelId = searchParams.get("reelId") || (location.state as any)?.reelId;
  const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("stem_reels");
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ title: "", description: "", videoFile: null as File | null });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchCategory, setSelectedSearchCategory] = useState("all");
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveDescription, setLiveDescription] = useState("");
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const fetchLiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("is_active", true)
        .order("started_at", { ascending: false });

      if (error) {
        console.error("Error fetching live sessions:", error);
        return;
      }

      if (data && data.length > 0) {
        const hostIds = [...new Set(data.map((s) => s.host_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", hostIds);

        const enriched = data.map((s) => ({
          ...s,
          profiles: profiles?.find((p) => p.id === s.host_id) || { name: "Live Streamer" },
        }));
        setLiveStreams(enriched);
      } else {
        setLiveStreams([]);
      }
    } catch (err) {
      console.error("Failed to load live sessions:", err);
    }
  };

  useEffect(() => {
    fetchReels();
    fetchLikedReels();
    fetchLiveSessions();

    const liveChannel = supabase
      .channel("live-sessions-discovery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions" },
        () => {
          fetchLiveSessions();
        }
      )
      .subscribe();

    // Regular interval to guarantee up-to-date live session list across all clients
    const interval = setInterval(fetchLiveSessions, 12000);

    return () => {
      supabase.removeChannel(liveChannel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (targetReelId && reels.length > 0) {
      const idx = reels.findIndex((r) => r.id === targetReelId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [targetReelId, reels]);

  useEffect(() => {
    if (reels.length > 0 && reels[currentIndex]) {
      incrementViews(reels[currentIndex].id);
    }
  }, [currentIndex, reels.length]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (isPlaying) videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  useEffect(() => {
    if (videoRef.current) {
      isPlaying ? videoRef.current.play().catch(() => {}) : videoRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const fetchReels = async () => {
    let { data, error } = await supabase
      .from("reels")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) { toast.error("Failed to load reels"); setIsLoading(false); return; }

    if (targetReelId && data) {
      const exists = data.some((r) => r.id === targetReelId);
      if (!exists) {
        const { data: specificReel } = await supabase
          .from("reels")
          .select("*")
          .eq("id", targetReelId)
          .maybeSingle();
        if (specificReel) {
          data = [specificReel, ...data];
        }
      }
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      const reelsWithProfiles = data.map(reel => ({
        ...reel,
        profiles: profiles?.find(p => p.id === reel.user_id) || { name: "Unknown" },
      }));

      // Shuffling algorithm: randomizes reel playback order so users experience a fresh feed on every visit
      let finalReels: Reel[];
      if (targetReelId) {
        // Keep the specifically requested target reel at the start
        const targetReel = reelsWithProfiles.find(r => r.id === targetReelId);
        const others = reelsWithProfiles.filter(r => r.id !== targetReelId);
        // Fisher-Yates shuffle remaining
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        finalReels = targetReel ? [targetReel, ...others] : others;
      } else {
        // Shuffle entire catalogue randomly
        const shuffled = [...reelsWithProfiles];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        finalReels = shuffled;
      }

      setReels(finalReels);
    } else {
      setReels(data || []);
    }
    setIsLoading(false);
  };

  const fetchLikedReels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("reel_likes").select("reel_id").eq("user_id", user.id);
    if (data) setLikedReels(new Set(data.map(l => l.reel_id)));
  };

  const incrementViews = async (reelId: string) => {
    await supabase.rpc("increment_reel_views", { reel_id: reelId });
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Please login to like reels");
      navigate("/auth?mode=login");
      return;
    }
    const currentReel = reels[currentIndex];
    const isLiked = likedReels.has(currentReel.id);

    if (isLiked) {
      await supabase.from("reel_likes").delete().eq("reel_id", currentReel.id).eq("user_id", user.id);
      await supabase.rpc("decrement_reel_likes", { reel_id: currentReel.id });
      setLikedReels(prev => { const s = new Set(prev); s.delete(currentReel.id); return s; });
      setReels(prev => prev.map((r, i) => i === currentIndex ? { ...r, likes_count: (r.likes_count || 1) - 1 } : r));
    } else {
      await supabase.from("reel_likes").insert({ reel_id: currentReel.id, user_id: user.id });
      await supabase.rpc("increment_reel_likes", { reel_id: currentReel.id });
      setLikedReels(prev => new Set(prev).add(currentReel.id));
      setReels(prev => prev.map((r, i) => i === currentIndex ? { ...r, likes_count: (r.likes_count || 0) + 1 } : r));

      // Notify reel owner if it's not their own reel
      if (currentReel.user_id !== user.id) {
        await notifyReelLike(
          user.id,
          currentReel.user_id,
          user.user_metadata?.full_name || user.email || "Someone",
          currentReel.title || "STEM Reel"
        );
      }
    }
  };

  const handleShare = async () => {
    const currentReel = reels[currentIndex];
    await supabase.rpc("increment_reel_shares", { reel_id: currentReel.id });
    const shareUrl = `${window.location.origin}/stem-reels?reel=${currentReel.id}`;
    if (navigator.share) {
      navigator.share({ title: currentReel.title || "STEM Reel", text: currentReel.description || "", url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
    setReels(prev => prev.map((r, i) => i === currentIndex ? { ...r, shares_count: (r.shares_count || 0) + 1 } : r));
  };

  const handleDownload = async () => {
    const currentReel = reels[currentIndex];
    try {
      const response = await fetch(currentReel.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentReel.title || "reel"}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Video saved!");
    } catch { toast.error("Failed to download"); }
  };

  const handleVideoFileSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 500MB upload limit.`);
      return;
    }
    setUploadData(p => ({ ...p, videoFile: file }));
    toast.success(`Video selected: ${(file.size / (1024 * 1024)).toFixed(1)} MB (Direct full-fidelity upload)`);
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error("Please login to upload reels");
      navigate("/auth?mode=signup");
      return;
    }
    if (!uploadData.videoFile) { toast.error("Please select a video"); return; }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const fileToUpload = uploadData.videoFile;
      const fileExt = fileToUpload.name.split('.').pop() || "mp4";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      setUploadProgress(45);

      const { error: uploadError } = await supabase.storage
        .from("reels")
        .upload(fileName, fileToUpload, {
          contentType: fileToUpload.type || "video/mp4",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(85);

      const { data: { publicUrl } } = supabase.storage.from("reels").getPublicUrl(fileName);
      const { error: insertError } = await supabase.from("reels").insert({
        user_id: user.id,
        title: uploadData.title || "STEM Reel",
        description: uploadData.description || null,
        video_url: publicUrl,
      });

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success("Reel uploaded successfully!");
      setUploadDialogOpen(false);
      setUploadData({ title: "", description: "", videoFile: null });
      fetchReels();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload video");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    if (direction === 'down' && currentIndex < reels.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    } else if (direction === 'up' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  }, [currentIndex, reels.length]);

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 50) handleScroll(deltaY > 0 ? 'down' : 'up');
  };

  // Wheel handling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) handleScroll(e.deltaY > 0 ? 'down' : 'up');
  }, [handleScroll]);

  // Keyboard handling — safely ignores typing in input, textarea, contenteditable, or modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
      );

      // Never intercept keystrokes when the user is actively typing in a form or dialog
      if (isInput || uploadDialogOpen || liveDialogOpen || showComments) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleScroll('down');
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleScroll('up');
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleScroll, uploadDialogOpen, liveDialogOpen, showComments]);

  const handleGoLive = async () => {
    if (!user) {
      toast.error("Please login to go live");
      navigate("/auth?mode=signup");
      return;
    }
    if (!liveTitle.trim()) { toast.error("Enter a title"); return; }

    setIsGoingLive(true);
    try {
      const roomId = `live-${Date.now()}`;
      const { error } = await supabase.from("live_sessions").insert({
        host_id: user.id, room_id: roomId, title: liveTitle, description: liveDescription,
        is_active: !isScheduling, is_scheduled: isScheduling,
        scheduled_at: isScheduling && scheduledDate ? new Date(scheduledDate).toISOString() : null,
      });
      if (error) throw error;
      if (isScheduling) {
        toast.success("Live session scheduled!");
        setLiveDialogOpen(false);
      } else {
        toast.success("Going live!");
        setLiveDialogOpen(false);
        navigate(`/live/${roomId}`);
      }
      setLiveTitle(""); setLiveDescription(""); setScheduledDate(""); setIsScheduling(false);
    } catch { toast.error("Failed to start live"); }
    finally { setIsGoingLive(false); }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    setShowPlayButton(true);
    setTimeout(() => setShowPlayButton(false), 800);
  };

  const formatCount = (n: number | null) => {
    if (!n) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const timeAgo = (date: string | null) => {
    if (!date) return "";
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
          <Video className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No Reels Yet</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">Be the first to create a STEM Reel!</p>
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full">
          <CameraRecorder onVideoRecorded={fetchReels} />
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="gap-2 w-full sm:w-auto">
            <Upload className="w-4 h-4 mr-2" /> Upload
          </Button>
        </div>
        <Button variant="ghost" className="mt-4 text-muted-foreground" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Upload STEM Reel</DialogTitle>
              <DialogDescription>
                Direct high-fidelity upload. Up to 72MB (Android), 287.6MB (iOS), or 500MB (Web). Video length up to 60 minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Title (e.g. Solving Physics Problem in 60s)"
                value={uploadData.title}
                onChange={e => setUploadData(p => ({ ...p, title: e.target.value }))}
                className="bg-secondary border-border/50"
              />
              <Textarea
                placeholder="Description & hashtags (optional)"
                value={uploadData.description}
                onChange={e => setUploadData(p => ({ ...p, description: e.target.value }))}
                className="bg-secondary border-border/50"
                rows={3}
              />
              <div
                className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors bg-secondary/20"
                onClick={() => document.getElementById('video-upload')?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {uploadData.videoFile ? uploadData.videoFile.name : "Tap to select video"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadData.videoFile
                    ? `${(uploadData.videoFile.size / (1024 * 1024)).toFixed(1)} MB • Direct high-quality upload`
                    : "Supports MP4, WebM, MOV up to 500MB (Max 60 mins)"}
                </p>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => handleVideoFileSelect(e.target.files?.[0] || null)}
                />
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="p-3 rounded-lg bg-secondary/60 border border-primary/20 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Uploading direct to STEM Reels cloud...
                    </span>
                    <span className="font-semibold text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress || 25}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={isUploading || !uploadData.videoFile}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading Reel...
                  </>
                ) : (
                  "Upload Reel"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const filteredSearchResults = reels.filter((r) => {
    const matchesCategory =
      selectedSearchCategory === "all" ||
      (r.title && r.title.toLowerCase().includes(selectedSearchCategory)) ||
      (r.description && r.description.toLowerCase().includes(selectedSearchCategory));

    if (!searchQuery.trim()) return matchesCategory;

    const q = searchQuery.toLowerCase();
    const matchesQuery =
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.profiles?.name && r.profiles.name.toLowerCase().includes(q));

    return matchesCategory && matchesQuery;
  });

  const currentReel = reels[currentIndex];
  const isLiked = likedReels.has(currentReel.id);

  return (
    <div
      ref={containerRef}
      className="h-screen bg-black relative overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Preview Banner */}
      {!user && isPreviewAvailable && (
        <div className="absolute top-16 left-4 right-4 z-50">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Preview mode - Login to upload reels and interact with content.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={currentReel.video_url}
        className="absolute inset-0 w-full h-full object-contain"
        loop
        playsInline
        autoPlay
        onClick={togglePlay}
      />

      {/* Play/Pause indicator */}
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            {isPlaying ? <Play className="w-8 h-8 text-white ml-1" /> : <Pause className="w-8 h-8 text-white" />}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">Reels</span>
          <span className="text-white/50 text-xs">·</span>
          {/* <span className="text-white/70 text-xs">{currentIndex + 1}/{reels.length}</span> */}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
            onClick={() => setSearchDialogOpen(true)}
            title="Search reels by title, creator, or topic"
          >
            <Search className="w-4 h-4" />
          </Button>

          <button
            onClick={() => { fetchLiveSessions(); setShowLivePanel(true); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              liveStreams.length > 0
                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/40 ring-2 ring-red-400/50"
                : "bg-white/10 hover:bg-white/20 text-white/80"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${liveStreams.length > 0 ? "bg-white animate-ping" : "bg-red-400"}`} />
            LIVE {liveStreams.length > 0 ? `(${liveStreams.length})` : ""}
          </button>
          <Dialog open={liveDialogOpen} onOpenChange={setLiveDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 bg-red-500/90 hover:bg-red-500 text-white text-xs border-0">
                <Radio className="w-3.5 h-3.5" />
                Live
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>{isScheduling ? "Schedule Live" : "Go Live"}</DialogTitle>
                <DialogDescription>Start streaming to your audience</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Live session title" value={liveTitle} onChange={e => setLiveTitle(e.target.value)} className="bg-secondary border-border/50" />
                <Textarea placeholder="Description (optional)" value={liveDescription} onChange={e => setLiveDescription(e.target.value)} className="bg-secondary border-border/50" rows={2} />
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={isScheduling} onChange={e => setIsScheduling(e.target.checked)} className="rounded border-border" />
                  Schedule for later
                </label>
                {isScheduling && <Input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="bg-secondary border-border/50" />}
                <Button onClick={handleGoLive} disabled={isGoingLive || (isScheduling && !scheduledDate)} className="w-full bg-red-500 hover:bg-red-600">
                  {isGoingLive ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isGoingLive ? "Starting..." : isScheduling ? "Schedule" : "Go Live Now"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Prominent Live Streams Discovery Strip */}
      {liveStreams.length > 0 && (
        <div className="absolute top-16 left-0 right-0 z-30 px-4 py-2 pointer-events-auto">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {liveStreams.map(stream => (
              <button
                key={stream.id}
                onClick={() => navigate(`/live/${stream.room_id}`)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-red-500/60 backdrop-blur-md shadow-lg shadow-red-500/20 shrink-0 hover:scale-105 active:scale-95 transition-all text-left"
              >
                <div className="relative">
                  <Avatar className="w-7 h-7 ring-2 ring-red-500">
                    <AvatarFallback className="bg-red-500/30 text-red-200 text-[10px] font-bold">
                      {(stream.profiles?.name || "H").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-black animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-red-500 text-[9px] font-extrabold text-white tracking-wider uppercase animate-pulse">
                      LIVE
                    </span>
                    <span className="text-white font-semibold text-xs max-w-[110px] truncate">
                      {stream.profiles?.name || "Host"}
                    </span>
                  </div>
                  <span className="text-[11px] text-white/80 max-w-[140px] truncate font-medium">
                    {stream.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-16 z-30 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {/* Creator */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="w-8 h-8 ring-2 ring-primary/50">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {(currentReel.profiles?.name || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => navigate(`/profile/${currentReel.user_id}`)}
            className="text-white text-sm font-semibold hover:underline"
          >
            @{currentReel.profiles?.name || "Unknown"}
          </button>
          <span className="text-white/40 text-xs">{timeAgo(currentReel.created_at)}</span>
        </div>

        {/* Title & Description */}
        {currentReel.title && <p className="text-white font-semibold text-sm mb-1">{currentReel.title}</p>}
        {currentReel.description && <p className="text-white/70 text-xs leading-relaxed line-clamp-2">{currentReel.description}</p>}

        {/* Views */}
        <div className="flex items-center gap-1 mt-2">
          <Eye className="w-3 h-3 text-white/40" />
          <span className="text-white/40 text-[11px]">{formatCount(currentReel.views_count)} views</span>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-5">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center group">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isLiked ? 'bg-red-500/20' : 'bg-white/10 backdrop-blur-sm'}`}>
            <Heart className={`w-6 h-6 transition-all ${isLiked ? "fill-red-500 text-red-500 scale-110" : "text-white group-hover:scale-110"}`} />
          </div>
          <span className="text-white text-[11px] mt-1 font-medium">{formatCount(currentReel.likes_count)}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => { setSelectedReelId(currentReel.id); setShowComments(true); }}
          className="flex flex-col items-center group"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] mt-1 font-medium">{formatCount(currentReel.comments_count)}</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center group">
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[11px] mt-1 font-medium">{formatCount(currentReel.shares_count)}</span>
        </button>

        {/* Save */}
        <button onClick={handleDownload} className="flex flex-col items-center group">
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[11px] mt-1 font-medium">Save</span>
        </button>

        {/* Mute */}
        <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-white/60" />}
          </div>
        </button>
      </div>

      {/* Navigation indicators */}
      {currentIndex > 0 && (
        <button onClick={() => handleScroll('up')} className="absolute top-20 left-1/2 -translate-x-1/2 z-20 text-white/30 hover:text-white/60 transition-colors">
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
      {currentIndex < reels.length - 1 && (
        <button onClick={() => handleScroll('down')} className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 text-white/30 hover:text-white/60 transition-colors animate-bounce">
          <ChevronDown className="w-6 h-6" />
        </button>
      )}

      {/* Progress dots */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
        {reels.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((_, i) => {
          const actualIndex = Math.max(0, currentIndex - 3) + i;
          return (
            <div key={actualIndex} className={`w-1 rounded-full transition-all duration-300 ${actualIndex === currentIndex ? 'h-4 bg-primary' : 'h-1.5 bg-white/20'}`} />
          );
        })}
      </div>

      {/* Create FAB */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div className="relative">
          {showCreateMenu && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center animate-in fade-in slide-in-from-bottom-2 duration-200">
              <CameraRecorder onVideoRecorded={() => { fetchReels(); setShowCreateMenu(false); }} />
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs shadow-lg" onClick={() => { setUploadDialogOpen(true); setShowCreateMenu(false); }}>
                <Upload className="w-3.5 h-3.5" /> Upload
              </Button>
            </div>
          )}
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="w-12 h-12 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className={`w-6 h-6 text-primary-foreground transition-transform duration-200 ${showCreateMenu ? 'rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Upload STEM Reel</DialogTitle>
            <DialogDescription>
              Direct high-fidelity upload. Up to 72MB (Android), 287.6MB (iOS), or 500MB (Web). Video length up to 60 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title (e.g. Solving Physics Problem in 60s)"
              value={uploadData.title}
              onChange={e => setUploadData(p => ({ ...p, title: e.target.value }))}
              className="bg-secondary border-border/50"
            />
            <Textarea
              placeholder="Description & hashtags (optional)"
              value={uploadData.description}
              onChange={e => setUploadData(p => ({ ...p, description: e.target.value }))}
              className="bg-secondary border-border/50"
              rows={3}
            />
            <div
              className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors bg-secondary/20"
              onClick={() => document.getElementById('video-upload-main')?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {uploadData.videoFile ? uploadData.videoFile.name : "Tap to select video"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadData.videoFile
                  ? `${(uploadData.videoFile.size / (1024 * 1024)).toFixed(1)} MB • Direct high-quality upload`
                  : "Supports MP4, WebM, MOV up to 500MB (Max 60 mins)"}
              </p>
              <input
                id="video-upload-main"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => handleVideoFileSelect(e.target.files?.[0] || null)}
              />
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="p-3 rounded-lg bg-secondary/60 border border-primary/20 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    Uploading direct to STEM Reels cloud...
                  </span>
                  <span className="font-semibold text-primary">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress || 25}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={isUploading || !uploadData.videoFile}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading Reel...
                </>
              ) : (
                "Upload Reel"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Streams Panel */}
      <Sheet open={showLivePanel} onOpenChange={setShowLivePanel}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl bg-card border-border/50">
          <SheetHeader>
            <SheetTitle className="text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live Now
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-2 overflow-y-auto h-[calc(100%-3rem)]">
            {liveStreams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Radio className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No live streams right now</p>
                <p className="text-xs text-muted-foreground mt-1">Be the first to go live!</p>
              </div>
            ) : (
              liveStreams.map(stream => (
                <button
                  key={stream.id}
                  onClick={() => { setShowLivePanel(false); navigate(`/live/${stream.room_id}`); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <p className="text-sm font-semibold text-foreground truncate">{stream.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">by {stream.profiles?.name || "Unknown"}</p>
                    {stream.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{stream.description}</p>}
                  </div>
                  <div className="flex-shrink-0 text-xs text-red-400 font-semibold">Watch →</div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Search Reels Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4 text-primary" />
              <span>Search STEM Reels</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Find reels by creator (@name), topic, scenario, or exam tags.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search creator, topic (e.g. WAEC, @David, calculus)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-secondary border-border/60"
              />
            </div>

            {/* Category / Scenario Quick Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: "all", label: "All" },
                { id: "waec", label: "WAEC & JAMB" },
                { id: "math", label: "Mathematics" },
                { id: "physics", label: "Physics" },
                { id: "chem", label: "Chemistry" },
                { id: "bio", label: "Biology & Med" },
                { id: "lab", label: "Lab Experiments" },
                { id: "exam", label: "Exam Tips" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedSearchCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                    selectedSearchCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredSearchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No matching reels found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredSearchResults.map((reel) => {
                  const reelIndex = reels.findIndex((r) => r.id === reel.id);
                  return (
                    <button
                      key={reel.id}
                      onClick={() => {
                        if (reelIndex >= 0) {
                          setCurrentIndex(reelIndex);
                          setIsPlaying(true);
                        }
                        setSearchDialogOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary transition-all text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                        <Play className="w-4 h-4 fill-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {reel.title || "STEM Reel"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          @{reel.profiles?.name || "Creator"} {reel.description ? `• ${reel.description}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatCount(reel.views_count)} views
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Sheet */}
      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-card border-border/50">
          <SheetHeader>
            <SheetTitle className="text-sm">Comments</SheetTitle>
          </SheetHeader>
          <div className="mt-3 h-[calc(100%-3rem)] overflow-hidden">
            {selectedReelId && (
              <CommentSection reelId={selectedReelId} onCommentCountChange={fetchReels} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default STEMReels;
