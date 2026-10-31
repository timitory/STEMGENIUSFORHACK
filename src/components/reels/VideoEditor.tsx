import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Type, Music, Wand2, Sticker, Sparkles, X, Plus, Volume2, Play, Pause,
  Loader2, Gauge, VolumeX, Check, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  color: string;
  fontSize: number;
  fontFamily: string;
}

interface VideoEditorProps {
  videoBlob: Blob;
  onSave: () => void;
  onClose: () => void;
}

const FILTERS = [
  { name: "Normal", value: "none" },
  { name: "Grayscale", value: "grayscale(100%)" },
  { name: "Sepia", value: "sepia(100%)" },
  { name: "Bright", value: "brightness(1.3)" },
  { name: "Contrast", value: "contrast(1.3)" },
  { name: "Saturate", value: "saturate(1.6)" },
  { name: "Cool", value: "hue-rotate(180deg) saturate(1.2)" },
  { name: "Vintage", value: "sepia(50%) contrast(1.1) brightness(0.9)" },
];

const STICKERS = ["🔥", "💡", "🧠", "⚡", "🔬", "🚀", "📐", "🧪", "✨", "🎯", "💯", "👏", "⭐", "🎓", "📚"];
const FONTS = ["Arial", "Georgia", "Courier New", "Verdana", "Impact"];
const COLORS = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#9b59b6", "#f39c12"];
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const MUSIC_TRACKS = [
  { id: "none", name: "None (Original Audio Only)" },
  { id: "stem_inspiration", name: "STEM Inspiration (Uplifting Ambient)" },
  { id: "deep_focus", name: "Deep Focus (Lo-Fi Study Beats)" },
  { id: "energetic_pulse", name: "Energy Pulse (Modern Tech)" },
];

export const VideoEditor = ({ videoBlob, onSave, onClose }: VideoEditorProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>("");
  
  // Editing state
  const [currentFilter, setCurrentFilter] = useState("none");
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [stickers, setStickers] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [volume, setVolume] = useState([100]);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  
  // Music state
  const [selectedMusic, setSelectedMusic] = useState<string>("none");
  const [musicVolume, setMusicVolume] = useState<number[]>([60]);
  const [isMusicPreviewPlaying, setIsMusicPreviewPlaying] = useState(false);
  const musicAudioRef = useRef<AudioContext | null>(null);
  const musicOscNodesRef = useRef<any[]>([]);

  // Text inputs
  const [newText, setNewText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(24);
  const [textFont, setTextFont] = useState("Arial");

  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Dragging state for text overlays and emoji stickers
  const [activeDrag, setActiveDrag] = useState<{
    type: "text" | "sticker";
    id: string;
    startX: number;
    startY: number;
    initialElemX: number;
    initialElemY: number;
  } | null>(null);

  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    type: "text" | "sticker",
    id: string,
    currentX: number,
    currentY: number
  ) => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setActiveDrag({
      type,
      id,
      startX: clientX,
      startY: clientY,
      initialElemX: currentX,
      initialElemY: currentY,
    });
  };

  const handleMoveDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!activeDrag || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

    const deltaX = clientX - activeDrag.startX;
    const deltaY = clientY - activeDrag.startY;

    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    const newX = Math.max(8, Math.min(92, activeDrag.initialElemX + deltaXPercent));
    const newY = Math.max(8, Math.min(92, activeDrag.initialElemY + deltaYPercent));

    if (activeDrag.type === "text") {
      setTextOverlays(prev => prev.map(t => (t.id === activeDrag.id ? { ...t, x: newX, y: newY } : t)));
    } else {
      setStickers(prev => prev.map(s => (s.id === activeDrag.id ? { ...s, x: newX, y: newY } : s)));
    }
  }, [activeDrag]);

  const handleEndDrag = useCallback(() => {
    setActiveDrag(null);
  }, []);

  useEffect(() => {
    if (!activeDrag) return;
    window.addEventListener("mousemove", handleMoveDrag);
    window.addEventListener("mouseup", handleEndDrag);
    window.addEventListener("touchmove", handleMoveDrag, { passive: false });
    window.addEventListener("touchend", handleEndDrag);
    return () => {
      window.removeEventListener("mousemove", handleMoveDrag);
      window.removeEventListener("mouseup", handleEndDrag);
      window.removeEventListener("touchmove", handleMoveDrag);
      window.removeEventListener("touchend", handleEndDrag);
    };
  }, [activeDrag, handleMoveDrag, handleEndDrag]);

  // Setup video source from recording Blob
  useEffect(() => {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    setVideoSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      stopProceduralMusic();
    };
  }, [videoBlob]);

  // Video element initialization
  useEffect(() => {
    if (videoRef.current && videoSrc) {
      videoRef.current.src = videoSrc;
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setVideoLoaded(true);
      }).catch(() => {
        setVideoLoaded(true);
      });
    }
  }, [videoSrc]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume[0] / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  // ── Procedural Ambient Music Player via Web Audio API ─────────────────────
  const stopProceduralMusic = () => {
    try {
      musicOscNodesRef.current.forEach(node => {
        try { node.stop(); node.disconnect(); } catch {}
      });
      musicOscNodesRef.current = [];
      if (musicAudioRef.current && musicAudioRef.current.state !== "closed") {
        musicAudioRef.current.close().catch(() => {});
      }
      musicAudioRef.current = null;
    } catch {}
    setIsMusicPreviewPlaying(false);
  };

  const playProceduralMusic = (trackId: string) => {
    stopProceduralMusic();
    if (trackId === "none") return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      musicAudioRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = (musicVolume[0] / 100) * 0.15;
      masterGain.connect(ctx.destination);

      // Frequencies for chords
      let notes = [261.63, 329.63, 392.00, 523.25]; // C major default
      if (trackId === "deep_focus") {
        notes = [220.00, 261.63, 329.63, 440.00]; // A minor chill
      } else if (trackId === "energetic_pulse") {
        notes = [293.66, 369.99, 440.00, 587.33]; // D major bright
      }

      const nodes: any[] = [];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Add subtle lfo vibrato
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(2 + idx, ctx.currentTime);
        lfoGain.gain.setValueAtTime(3, ctx.currentTime);
        lfo.connect(osc.frequency);
        lfo.start();

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();

        nodes.push(osc, lfo);
      });

      musicOscNodesRef.current = nodes;
      setIsMusicPreviewPlaying(true);
    } catch (e) {
      console.warn("Could not start procedural audio:", e);
    }
  };

  const handleSelectMusic = (trackId: string) => {
    setSelectedMusic(trackId);
    if (trackId === "none") {
      stopProceduralMusic();
    } else {
      playProceduralMusic(trackId);
    }
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newText.trim(),
        x: 50,
        y: 40 + (prev.length * 10) % 40,
        color: textColor,
        fontSize: textSize,
        fontFamily: textFont,
      },
    ]);
    setNewText("");
    toast.success("Text overlay added!");
  };

  const addSticker = (emoji: string) => {
    setStickers(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        emoji,
        x: 50 + (Math.random() * 20 - 10),
        y: 50 + (Math.random() * 20 - 10),
      },
    ]);
    toast.success("Sticker added!");
  };

  // ── Client-Side Export Pipeline (Canvas + MediaRecorder) ───────────────────
  const renderCompositeVideo = async (): Promise<Blob> => {
    const hasEdits =
      currentFilter !== "none" ||
      textOverlays.length > 0 ||
      stickers.length > 0 ||
      playbackSpeed !== 1.0 ||
      isMuted ||
      volume[0] !== 100 ||
      selectedMusic !== "none";

    // If no edits were applied, fast-path return the original recording blob
    if (!hasEdits) {
      return videoBlob;
    }

    return new Promise(async (resolve, reject) => {
      setExportProgress("Preparing export canvas...");

      const renderVideo = document.createElement("video");
      renderVideo.src = videoSrc;
      renderVideo.crossOrigin = "anonymous";
      renderVideo.playsInline = true;
      renderVideo.muted = false;
      renderVideo.playbackRate = playbackSpeed;

      await new Promise<void>((r) => {
        renderVideo.onloadedmetadata = () => r();
      });

      const width = renderVideo.videoWidth || 720;
      const height = renderVideo.videoHeight || 1280;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(videoBlob);
        return;
      }

      // Audio mixing
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      try {
        const videoSource = audioCtx.createMediaElementSource(renderVideo);
        const videoGain = audioCtx.createGain();
        videoGain.gain.value = isMuted ? 0 : volume[0] / 100;
        videoSource.connect(videoGain);
        videoGain.connect(dest);
      } catch (e) {
        console.warn("Could not capture video element audio:", e);
      }

      // Mix background procedural music if selected
      if (selectedMusic !== "none") {
        try {
          const bgGain = audioCtx.createGain();
          bgGain.gain.value = (musicVolume[0] / 100) * 0.18;
          bgGain.connect(dest);

          let notes = [261.63, 329.63, 392.00, 523.25];
          if (selectedMusic === "deep_focus") notes = [220.00, 261.63, 329.63, 440.00];
          else if (selectedMusic === "energetic_pulse") notes = [293.66, 369.99, 440.00, 587.33];

          notes.forEach(f => {
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(f, audioCtx.currentTime);
            osc.connect(bgGain);
            osc.start();
          });
        } catch (e) {
          console.warn("Background audio mixing error:", e);
        }
      }

      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        audioCtx.close().catch(() => {});
        const outputBlob = new Blob(chunks, { type: "video/webm" });
        resolve(outputBlob);
      };

      recorder.onerror = (e) => {
        console.error("Recording error:", e);
        resolve(videoBlob);
      };

      // Draw loop
      let animId: number;
      const drawFrame = () => {
        if (renderVideo.ended || renderVideo.paused) return;

        // Apply visual filter
        ctx.filter = currentFilter !== "none" ? currentFilter : "none";
        ctx.drawImage(renderVideo, 0, 0, width, height);
        ctx.filter = "none";

        // Draw Text Overlays
        textOverlays.forEach(overlay => {
          const px = (overlay.x / 100) * width;
          const py = (overlay.y / 100) * height;
          const scale = width / 400; // responsive scale
          ctx.font = `bold ${Math.round(overlay.fontSize * scale)}px ${overlay.fontFamily}`;
          ctx.fillStyle = overlay.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillText(overlay.text, px, py);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });

        // Draw Stickers
        stickers.forEach(sticker => {
          const px = (sticker.x / 100) * width;
          const py = (sticker.y / 100) * height;
          const scale = width / 400;
          ctx.font = `${Math.round(36 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sticker.emoji, px, py);
        });

        const progressPercent = Math.min(
          99,
          Math.round((renderVideo.currentTime / (renderVideo.duration || 1)) * 100)
        );
        setExportProgress(`Rendering effects (${progressPercent}%)...`);

        animId = requestAnimationFrame(drawFrame);
      };

      recorder.start(100);
      renderVideo.currentTime = 0;
      await renderVideo.play();
      drawFrame();

      renderVideo.onended = () => {
        cancelAnimationFrame(animId);
        setExportProgress("Finalising export...");
        setTimeout(() => recorder.stop(), 200);
      };
    });
  };

  const handleUpload = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please login to post Reels"); return; }
    if (!title.trim()) { toast.error("Please enter a title for your Reel"); return; }

    setIsUploading(true);
    stopProceduralMusic();

    try {
      // 1. Render all effects, overlays, filters, and audio into final media blob
      const exportedBlob = await renderCompositeVideo();

      setExportProgress("Uploading Reel to library...");
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("reels")
        .upload(fileName, exportedBlob, { contentType: "video/webm", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("reels")
        .getPublicUrl(fileName);

      // 2. Insert Reel record
      const { error: insertError } = await supabase.from("reels").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        video_url: publicUrl,
      });

      if (insertError) throw insertError;

      toast.success("STEM Reel published successfully with all effects!");
      onSave();
    } catch (err: any) {
      console.error("Failed to export/upload reel:", err);
      toast.error(err.message || "Failed to publish reel.");
    } finally {
      setIsUploading(false);
      setExportProgress("");
    }
  };

  return (
    <Dialog open onOpenChange={() => { stopProceduralMusic(); onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-card border-border p-0">
        <div className="p-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              STEM Reels Studio — Video Editor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add filters, captions, stickers, speed effects and music. All edits are permanently exported to the published video.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Video Preview */}
          <div
            ref={previewContainerRef}
            className="relative bg-black aspect-[9/16] max-h-[65vh] overflow-hidden flex items-center justify-center border-r border-border/40 select-none"
          >
            <video
              ref={videoRef}
              src={videoSrc || undefined}
              className="w-full h-full object-cover cursor-pointer"
              style={{ filter: currentFilter }}
              loop
              playsInline
              preload="auto"
              onLoadedData={() => setVideoLoaded(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlayback}
            />

            {!videoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-0">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Text Overlays in Preview — draggable & repositionable */}
            {textOverlays.map(o => {
              const isDraggingThis = activeDrag?.type === "text" && activeDrag.id === o.id;
              return (
                <div
                  key={o.id}
                  onMouseDown={(e) => handleStartDrag(e, "text", o.id, o.x, o.y)}
                  onTouchStart={(e) => handleStartDrag(e, "text", o.id, o.x, o.y)}
                  className={`absolute group select-none pointer-events-auto cursor-grab active:cursor-grabbing p-1.5 rounded transition-shadow ${
                    isDraggingThis ? "ring-2 ring-primary bg-black/40 scale-105" : "hover:ring-1 hover:ring-white/40"
                  }`}
                  style={{
                    left: `${o.x}%`,
                    top: `${o.y}%`,
                    transform: "translate(-50%, -50%)",
                    color: o.color,
                    fontSize: `${o.fontSize}px`,
                    fontFamily: o.fontFamily,
                    textShadow: "2px 2px 4px rgba(0,0,0,0.9)",
                    touchAction: "none",
                  }}
                  title="Drag to reposition text overlay"
                >
                  {o.text}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTextOverlays(p => p.filter(t => t.id !== o.id));
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-20 cursor-pointer"
                    title="Remove text"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}

            {/* Stickers in Preview — draggable & repositionable */}
            {stickers.map(s => {
              const isDraggingThis = activeDrag?.type === "sticker" && activeDrag.id === s.id;
              return (
                <div
                  key={s.id}
                  onMouseDown={(e) => handleStartDrag(e, "sticker", s.id, s.x, s.y)}
                  onTouchStart={(e) => handleStartDrag(e, "sticker", s.id, s.x, s.y)}
                  className={`absolute group select-none pointer-events-auto cursor-grab active:cursor-grabbing text-3xl p-1 rounded transition-transform ${
                    isDraggingThis ? "scale-125 ring-2 ring-primary bg-black/40" : "hover:scale-110"
                  }`}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    transform: "translate(-50%, -50%)",
                    touchAction: "none",
                  }}
                  title="Drag to reposition sticker"
                >
                  {s.emoji}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStickers(p => p.filter(st => st.id !== s.id));
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-20 cursor-pointer text-xs"
                    title="Remove sticker"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}

            {/* Play/Pause Button */}
            <button
              onClick={togglePlayback}
              className="absolute bottom-3 left-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm z-10 hover:bg-black/80 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
            </button>
          </div>

          {/* Editor Tools */}
          <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
            <Tabs defaultValue="filters" className="w-full">
              <TabsList className="grid grid-cols-5 w-full h-9 bg-secondary">
                <TabsTrigger value="filters" className="text-xs h-7 gap-1"><Wand2 className="w-3 h-3" /> Filters</TabsTrigger>
                <TabsTrigger value="text" className="text-xs h-7 gap-1"><Type className="w-3 h-3" /> Text</TabsTrigger>
                <TabsTrigger value="stickers" className="text-xs h-7 gap-1"><Sticker className="w-3 h-3" /> Stickers</TabsTrigger>
                <TabsTrigger value="music" className="text-xs h-7 gap-1"><Music className="w-3 h-3" /> Music</TabsTrigger>
                <TabsTrigger value="speed" className="text-xs h-7 gap-1"><Gauge className="w-3 h-3" /> Speed</TabsTrigger>
              </TabsList>

              {/* Filters Tab */}
              <TabsContent value="filters" className="mt-3">
                <div className="grid grid-cols-2 gap-2">
                  {FILTERS.map(f => (
                    <button
                      key={f.name}
                      onClick={() => setCurrentFilter(f.value)}
                      className={`h-9 rounded-lg text-xs font-medium transition-all border ${
                        currentFilter === f.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="space-y-3 mt-3">
                <Input
                  placeholder="Enter caption or subtitle..."
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                  className="h-8 text-xs bg-secondary border-border/50"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        textColor === c ? "border-primary scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setTextColor(c)}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] text-muted-foreground w-8">Size</span>
                  <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={12} max={48} className="flex-1" />
                  <span className="text-[11px] text-muted-foreground w-6">{textSize}px</span>
                </div>
                <select
                  value={textFont}
                  onChange={e => setTextFont(e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-border/50 bg-secondary px-2 text-foreground"
                >
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <Button onClick={addTextOverlay} size="sm" className="w-full h-8 text-xs gap-1.5 bg-primary text-primary-foreground">
                  <Plus className="w-3 h-3" /> Add Text Overlay
                </Button>
              </TabsContent>

              {/* Stickers Tab */}
              <TabsContent value="stickers" className="mt-3">
                <div className="grid grid-cols-5 gap-2">
                  {STICKERS.map(emoji => (
                    <button
                      key={emoji}
                      className="text-2xl hover:scale-125 transition-transform p-2 rounded-lg bg-secondary/30 hover:bg-secondary text-center"
                      onClick={() => addSticker(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Music Tab */}
              <TabsContent value="music" className="space-y-3 mt-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Background Track</label>
                  <div className="space-y-1.5">
                    {MUSIC_TRACKS.map(track => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => handleSelectMusic(track.id)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                          selectedMusic === track.id
                            ? "bg-primary/20 border-primary text-primary font-semibold"
                            : "bg-secondary/30 border-border/40 text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span>{track.name}</span>
                        {selectedMusic === track.id && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedMusic !== "none" && (
                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Music Volume</span>
                      <span className="text-[11px] font-semibold text-primary">{musicVolume[0]}%</span>
                    </div>
                    <Slider value={musicVolume} onValueChange={setMusicVolume} min={0} max={100} />
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Original Audio Volume</span>
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3" />}
                      {isMuted ? "Unmute" : "Mute original"}
                    </button>
                  </div>
                  <Slider value={volume} onValueChange={setVolume} min={0} max={100} disabled={isMuted} />
                </div>
              </TabsContent>

              {/* Speed Tab */}
              <TabsContent value="speed" className="space-y-3 mt-3">
                <label className="text-xs font-semibold text-foreground">Playback & Export Speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPEED_OPTIONS.map(spd => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        playbackSpeed === spd
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {spd}x {spd === 1.0 ? "(Normal)" : ""}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Video Details & Publish */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <Input
                placeholder="Reel Title * (e.g. Solving tricky organic chemistry reaction)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                className="h-9 text-xs bg-secondary border-border/50"
              />
              <Textarea
                placeholder="Description & hashtags (optional)..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                rows={2}
                className="text-xs bg-secondary border-border/50 resize-none"
              />
              <Button
                onClick={handleUpload}
                disabled={isUploading || !title.trim()}
                className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 glow-primary"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {exportProgress || "Exporting & Posting..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Export & Post Reel
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
