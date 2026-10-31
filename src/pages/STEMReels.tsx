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
import { Heart, MessageCircle, Share2, Play, Pause, Upload, Video, Radio, Download, ArrowLeft, ChevronUp, ChevronDown, Eye, Plus, Music, Loader2, Volume2, VolumeX, Bookmark, MoreHorizontal, Verified, AlertCircle } from "lucide-react";
import { CameraRecorder } from "@/components/reels/CameraRecorder";
import { CommentSection } from "@/components/reels/CommentSection";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFeatureAuth } from "@/hooks/useFeatureAuth";

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
    const { data } = await supabase
      .from("live_sessions")
      .select("*, profiles:host_id(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setLiveStreams(data || []);
  };

  useEffect(() => {
    fetchReels();
    fetchLikedReels();
    fetchLiveSessions();
    const liveChannel = supabase.channel("live-sessions-discovery")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, fetchLiveSessions)
      .subscribe();
    return () => { supabase.removeChannel(liveChannel); };
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
      setReels(reelsWithProfiles);
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

  const handleUpload = async () => {
    if (!user) {
      toast.error("Please login to upload reels");
      navigate("/auth?mode=signup");
      return;
    }
    if (!uploadData.videoFile) { toast.error("Please select a video"); return; }

    setIsUploading(true);
    try {
      const fileExt = uploadData.videoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("reels").upload(fileName, uploadData.videoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("reels").getPublicUrl(fileName);
      const { error: insertError } = await supabase.from("reels").insert({
        user_id: user.id,
        title: uploadData.title,
        description: uploadData.description,
        video_url: publicUrl,
      });
      if (insertError) throw insertError;
      toast.success("Reel uploaded!");
      setUploadDialogOpen(false);
      setUploadData({ title: "", description: "", videoFile: null });
      fetchReels();
    } catch { toast.error("Failed to upload"); }
    finally { setIsUploading(false); }
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
        <Button variant="ghost" className="mt-4 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Upload Reel</DialogTitle>
              <DialogDescription>Share your STEM content with the community</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={uploadData.title} onChange={e => setUploadData(p => ({ ...p, title: e.target.value }))} className="bg-secondary border-border/50" />
              <Textarea placeholder="Description" value={uploadData.description} onChange={e => setUploadData(p => ({ ...p, description: e.target.value }))} className="bg-secondary border-border/50" rows={3} />
              <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => document.getElementById('video-upload')?.click()}>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{uploadData.videoFile ? uploadData.videoFile.name : "Tap to select video"}</p>
                <input id="video-upload" type="file" accept="video/*" className="hidden" onChange={e => setUploadData(p => ({ ...p, videoFile: e.target.files?.[0] || null }))} />
              </div>
              <Button onClick={handleUpload} disabled={isUploading} className="w-full">{isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : "Upload"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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
        <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">Reels</span>
          <span className="text-white/50 text-xs">·</span>
          {/* <span className="text-white/70 text-xs">{currentIndex + 1}/{reels.length}</span> */}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => { fetchLiveSessions(); setShowLivePanel(true); }}
            className="flex items-center gap-1 bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Upload Reel</DialogTitle>
            <DialogDescription>Share your STEM content</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={uploadData.title} onChange={e => setUploadData(p => ({ ...p, title: e.target.value }))} className="bg-secondary border-border/50" />
            <Textarea placeholder="Description" value={uploadData.description} onChange={e => setUploadData(p => ({ ...p, description: e.target.value }))} className="bg-secondary border-border/50" rows={3} />
            <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => document.getElementById('video-upload-main')?.click()}>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{uploadData.videoFile ? uploadData.videoFile.name : "Tap to select video"}</p>
              <input id="video-upload-main" type="file" accept="video/*" className="hidden" onChange={e => setUploadData(p => ({ ...p, videoFile: e.target.files?.[0] || null }))} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading} className="w-full">{isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : "Upload"}</Button>
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
