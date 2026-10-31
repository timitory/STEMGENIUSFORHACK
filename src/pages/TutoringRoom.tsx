import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MessageSquare, 
  PenTool, Eraser, Trash2, Send, Clock, Star, ShieldCheck, Users, 
  Maximize2, Sparkles, BookOpen, CheckCircle2, Loader2, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { submitTutorReview } from "@/lib/tutorService";
import { createPeerConnection } from "@/lib/webrtcService";
import { fetchIceServers, type IceServerConfig } from "@/lib/webrtcService";

interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  time: string;
}

export default function TutoringRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Audio / Video states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // WebRTC peer connection for real 2-way A/V with the remote participant
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteName, setRemoteName] = useState<string>("");
  const iceConfigRef = useRef<IceServerConfig | null>(null);

  // View mode: 'split' (video + whiteboard), 'whiteboard_focus', 'video_focus'
  const [viewMode, setViewMode] = useState<"split" | "whiteboard" | "video">("split");

  // Chat states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Whiteboard Canvas states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#a855f7"); // primary violet
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  // Session timer
  const [secondsRemaining, setSecondsRemaining] = useState(3600);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Post-session review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      setUser(authSession?.user ?? null);
      if (!authSession?.user) {
        toast.error("Please login to join the tutoring room");
        navigate("/auth");
        return;
      }
      initializeRoom(authSession.user.id);
    });

    return () => {
      cleanupMedia();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId]);

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const initializeRoom = async (userId: string) => {
    try {
      setLoading(true);

      const [profileRes, bookingRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("tutor_bookings").select("*, tutor_profiles(*, profiles:user_id(name))").eq("room_id", roomId).maybeSingle(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (bookingRes.data) setBooking(bookingRes.data);

      // Start local webcam stream
      await startCameraStream();

      // Fetch TURN + STUN config from backend before creating any peer connections
      iceConfigRef.current = await fetchIceServers();
      console.info(
        `[TutoringRoom] ICE servers ready — hasTurn=${iceConfigRef.current.hasTurn}`
      );

      // Setup Supabase Realtime channel for whiteboard, chat AND WebRTC signalling
      const channel = supabase.channel(`tutoring-room-${roomId}`);

      // ── Helper: create / reuse the single peer connection ──────────────────
      const getOrCreatePc = (peerName: string) => {
        if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== "closed") {
          return peerConnectionRef.current;
        }
        // Reset remote stream for fresh connection
        remoteStreamRef.current = new MediaStream();
        setRemoteConnected(false);

        const pc = createPeerConnection(
          "peer",
          localStreamRef.current,
          (_track, stream) => {
            // Attach each incoming track to the shared remote stream
            stream.getTracks().forEach((t) => {
              if (!remoteStreamRef.current.getTracks().includes(t)) {
                remoteStreamRef.current.addTrack(t);
              }
            });
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
            setRemoteConnected(true);
            if (peerName) setRemoteName(peerName);
          },
          (candidate) => {
            channel.send({
              type: "broadcast",
              event: "tutoring_ice",
              payload: { from: userId, candidate },
            });
          },
          (state) => {
            console.info(`[TutoringRoom] Peer connection state: ${state}`);
            if (state === "disconnected" || state === "failed") {
              // Give it a moment — ICE restart may recover
              console.warn("[TutoringRoom] Connection degraded; waiting for ICE restart...");
            }
            if (state === "closed") {
              setRemoteConnected(false);
            }
          },
          iceConfigRef.current ?? undefined,
        );
        peerConnectionRef.current = pc;
        return pc;
      };

      channel
        .on("broadcast", { event: "chat_message" }, ({ payload }) => {
          setMessages((prev) => [...prev, payload]);
        })
        .on("broadcast", { event: "whiteboard_draw" }, ({ payload }) => {
          drawRemoteStroke(payload);
        })
        .on("broadcast", { event: "whiteboard_clear" }, () => {
          clearCanvasLocal();
        })
        // ── WebRTC signalling ─────────────────────────────────────────────────
        .on("broadcast", { event: "tutoring_offer" }, async ({ payload }) => {
          if (payload.to !== userId) return;
          const pc = getOrCreatePc(payload.name || "");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "tutoring_answer",
              payload: { from: userId, to: payload.from, sdp: answer },
            });
          } catch (err) {
            console.warn("Error handling tutoring offer:", err);
          }
        })
        .on("broadcast", { event: "tutoring_answer" }, async ({ payload }) => {
          if (payload.to !== userId) return;
          const pc = peerConnectionRef.current;
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } catch (err) {
              console.warn("Error setting tutoring answer:", err);
            }
          }
        })
        .on("broadcast", { event: "tutoring_ice" }, async ({ payload }) => {
          if (payload.from === userId) return;
          const pc = peerConnectionRef.current;
          if (pc && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.warn("Error adding ICE candidate:", err);
            }
          }
        })
        .on("broadcast", { event: "tutoring_peer_join" }, async ({ payload }) => {
          // The new joiner triggers the existing participant to create an offer
          if (payload.from === userId) return;
          setRemoteName(payload.name || "");
          const pc = getOrCreatePc(payload.name || "");
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "tutoring_offer",
              payload: { from: userId, to: payload.from, name: profileRes.data?.name || "Participant", sdp: offer },
            });
          } catch (err) {
            console.warn("Error creating tutoring offer:", err);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Announce presence so the other participant can initiate WebRTC
            channel.send({
              type: "broadcast",
              event: "tutoring_peer_join",
              payload: { from: userId, name: profileRes.data?.name || "Participant" },
            });
          }
        });

      // Start session countdown
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } catch (err) {
      console.error("Room init error:", err);
      toast.error("Could not initialize classroom session");
    } finally {
      setLoading(false);
    }
  };

  const startCameraStream = async () => {
    let stream: MediaStream | null = null;
    try {
      // Try acquiring both video and audio
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setIsVideoOff(false);
      setIsMuted(false);
    } catch (bothErr) {
      console.warn("Could not acquire both video and audio, trying individual devices:", bothErr);
      // Try audio only
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setIsVideoOff(true);
        setIsMuted(false);
        toast.info("Connected with microphone only (camera unavailable or unpermitted).");
      } catch (audioErr) {
        // Try video only
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          setIsVideoOff(false);
          setIsMuted(true);
          toast.info("Connected with camera only (microphone unavailable or unpermitted).");
        } catch (videoErr) {
          console.warn("No local media stream available:", videoErr);
          setIsVideoOff(true);
          setIsMuted(true);
          toast.info("Room loaded in presentation mode without local camera/mic stream.");
        }
      }
    }

    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") console.warn("Video play() rejected:", err);
        });
      }
    }
  };

  const toggleMic = async () => {
    const existingAudioTracks = localStreamRef.current?.getAudioTracks() || [];
    if (existingAudioTracks.length > 0) {
      const willMute = !isMuted;
      existingAudioTracks.forEach((track) => {
        track.enabled = !willMute;
      });
      setIsMuted(willMute);
      if (willMute) {
        toast.info("Microphone muted");
      } else {
        toast.success("Microphone unmuted");
      }
    } else {
      // Dynamic acquire
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        const audioTrack = stream.getAudioTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(audioTrack);
        } else {
          localStreamRef.current = new MediaStream([audioTrack]);
        }
        // Sync to active peer connection sender
        if (peerConnectionRef.current) {
          const audioSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "audio");
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(console.warn);
          } else {
            peerConnectionRef.current.addTrack(audioTrack, localStreamRef.current!);
          }
        }
        setIsMuted(false);
        toast.success("Microphone connected and unmuted");
      } catch (err: any) {
        console.error("Mic error:", err);
        toast.error("Microphone access denied or unavailable.");
      }
    }
  };

  const toggleVideo = async () => {
    const existingVideoTracks = localStreamRef.current?.getVideoTracks() || [];
    if (existingVideoTracks.length > 0) {
      const willTurnOff = !isVideoOff;
      existingVideoTracks.forEach((track) => {
        track.enabled = !willTurnOff;
      });
      setIsVideoOff(willTurnOff);
      if (willTurnOff) {
        toast.info("Camera paused");
      } else {
        toast.success("Camera resumed");
      }
    } else {
      // Dynamic acquire
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        // Remove any stale video tracks first
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current!.removeTrack(t);
        });
        localStreamRef.current.addTrack(videoTrack);
        if (localVideoRef.current) {
          // Re-assign srcObject to force browser to pick up the new track
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch((err) => {
            if (err.name !== "AbortError") console.warn("Video play() rejected:", err);
          });
        }
        // Also add the new track to the active peer connection so remote sees it
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack).catch(console.warn);
          } else {
            peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
          }
        }
        setIsVideoOff(false);
        toast.success("Camera connected");
      } catch (err: any) {
        console.error("Video error:", err);
        toast.error("Camera access denied or unavailable.");
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share, revert to camera if available
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current?.removeTrack(videoTrack);
      }
      setIsScreenSharing(false);
      toast.info("Screen sharing ended");
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack).catch(console.warn);
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          // Restore camera track
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
        setIsScreenSharing(true);
        toast.success("Screen sharing started");
      } catch (err: any) {
        if (err.name !== "NotAllowedError") {
          toast.error("Screen share failed: " + (err.message || "Unknown error"));
        }
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messagePayload: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderName: profile?.name || "Participant",
      senderId: user.id,
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, messagePayload]);
    setNewMessage("");

    // Broadcast message via Supabase Realtime
    await supabase.channel(`tutoring-room-${roomId}`).send({
      type: "broadcast",
      event: "chat_message",
      payload: messagePayload,
    });
  };

  // Whiteboard drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = tool === "eraser" ? "#0f1219" : penColor;
    ctx.lineWidth = tool === "eraser" ? 20 : brushSize;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();

    // Broadcast stroke
    supabase.channel(`tutoring-room-${roomId}`).send({
      type: "broadcast",
      event: "whiteboard_draw",
      payload: { x, y, color: penColor, size: brushSize, tool },
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawRemoteStroke = (payload: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = payload.tool === "eraser" ? "#0f1219" : payload.color;
    ctx.lineWidth = payload.tool === "eraser" ? 20 : payload.size;
    ctx.lineCap = "round";
    ctx.lineTo(payload.x, payload.y);
    ctx.stroke();
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearWhiteboard = async () => {
    clearCanvasLocal();
    await supabase.channel(`tutoring-room-${roomId}`).send({
      type: "broadcast",
      event: "whiteboard_clear",
      payload: {},
    });
  };

  const handleLeaveRoom = () => {
    cleanupMedia();
    if (booking && user && booking.student_id === user.id) {
      setReviewModalOpen(true);
    } else {
      navigate("/tutors");
    }
  };

  const handleSubmitReview = async () => {
    if (!booking) return;
    setIsSubmittingReview(true);
    try {
      await submitTutorReview({
        bookingId: booking.id,
        tutorId: booking.tutor_id,
        studentId: user.id,
        rating: ratingScore,
        reviewText: reviewComment.trim() || undefined,
      });
      toast.success("Thank you for your feedback!");
      setReviewModalOpen(false);
      navigate("/tutors");
    } catch {
      toast.error("Failed to submit review");
      navigate("/tutors");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Connecting to STEM Genius Tutoring Room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Room Header */}
      <header className="h-16 border-b border-border/60 bg-background/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLeaveRoom}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>{booking?.subject || "Live STEM Lesson"}</span>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30 uppercase">
                {booking?.session_format === "group" ? "Group Class" : "1-on-1"}
              </Badge>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Tutor: {booking?.tutor_profiles?.profiles?.name || "Verified Tutor"} • Room: {roomId?.slice(0, 15)}...
            </p>
          </div>
        </div>

        {/* Center Countdown Timer */}
        <div className="flex items-center gap-2 bg-secondary/60 px-3 py-1.5 rounded-full border border-border/50 text-xs font-mono font-bold text-foreground">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span>{formatTimer(secondsRemaining)} remaining</span>
        </div>

        {/* Connection Diagnostics */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full border border-border/40">
          <span className={isMuted ? "text-red-400" : "text-green-400"}>🎤 {isMuted ? "Muted" : "Live"}</span>
          <span>·</span>
          <span className={isVideoOff ? "text-red-400" : "text-green-400"}>📹 {isVideoOff ? "Off" : "On"}</span>
          <span>·</span>
          <span className={remoteConnected ? "text-green-400" : "text-yellow-400"}>{remoteConnected ? "● Connected" : "○ Waiting"}</span>
        </div>

        {/* View Toggle & Leave Button */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/40 text-xs">
            <button
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "split" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("whiteboard")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "whiteboard" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Whiteboard Focus
            </button>
            <button
              onClick={() => setViewMode("video")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "video" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Video Focus
            </button>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleLeaveRoom}
            className="text-xs h-8 px-3 gap-1.5 font-semibold"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Room</span>
          </Button>
        </div>
      </header>

      {/* Main Classroom Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Main Workspace (Whiteboard / Videos) - 8 or 9 cols */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-3 overflow-hidden">
          {/* Whiteboard Canvas */}
          {(viewMode === "split" || viewMode === "whiteboard") && (
            <Card className="flex-1 glass-card border-border/60 flex flex-col overflow-hidden relative">
              {/* Whiteboard Toolbar */}
              <div className="h-12 border-b border-border/40 bg-secondary/40 px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mr-2">
                    <PenTool className="w-3.5 h-3.5 text-primary" />
                    Whiteboard
                  </span>

                  {/* Colors */}
                  {["#a855f7", "#facc15", "#22c55e", "#ef4444", "#38bdf8", "#ffffff"].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setPenColor(color);
                        setTool("pen");
                      }}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        penColor === color && tool === "pen" ? "scale-125 ring-2 ring-primary" : "border-border/60"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}

                  <div className="h-4 w-px bg-border/50 mx-1" />

                  {/* Tools */}
                  <Button
                    size="sm"
                    variant={tool === "pen" ? "secondary" : "ghost"}
                    onClick={() => setTool("pen")}
                    className="h-7 px-2 text-xs"
                  >
                    <PenTool className="w-3 h-3 mr-1" /> Pen
                  </Button>
                  <Button
                    size="sm"
                    variant={tool === "eraser" ? "secondary" : "ghost"}
                    onClick={() => setTool("eraser")}
                    className="h-7 px-2 text-xs"
                  >
                    <Eraser className="w-3 h-3 mr-1" /> Eraser
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearWhiteboard}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>

              {/* Drawing Canvas */}
              <div className="flex-1 bg-[#0f1219] relative cursor-crosshair overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={800}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    setIsDrawing(true);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!isDrawing) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                    ctx.strokeStyle = tool === "eraser" ? "#0f1219" : penColor;
                    ctx.lineWidth = tool === "eraser" ? 20 : brushSize;
                    ctx.lineCap = "round";
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    supabase.channel(`tutoring-room-${roomId}`).send({
                      type: "broadcast",
                      event: "whiteboard_draw",
                      payload: { x, y, color: penColor, size: brushSize, tool },
                    });
                  }}
                  onTouchEnd={() => setIsDrawing(false)}
                  style={{ touchAction: "none" }}
                  className="w-full h-full object-contain"
                />
              </div>
            </Card>
          )}

          {/* Video Streams & Media Bar */}
          <div className="h-44 sm:h-52 shrink-0 flex gap-3 overflow-x-auto">
            {/* Local Video */}
            <div className="w-56 sm:w-72 bg-secondary/60 rounded-xl border border-border/50 relative overflow-hidden shrink-0 flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? "hidden" : "block"}`}
              />
              {isVideoOff && (
                <div className="text-center text-xs text-muted-foreground">
                  <VideoOff className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
                  Camera Off
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
                You ({profile?.name || "Participant"})
              </div>
            </div>

            {/* Remote Peer — real WebRTC stream */}
            <div className="flex-1 min-w-[200px] bg-secondary/40 rounded-xl border border-border/50 relative flex items-center justify-center overflow-hidden">
              {remoteConnected ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto text-base font-bold">
                    {(remoteName || booking?.tutor_profiles?.profiles?.name || "T").charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {remoteName || booking?.tutor_profiles?.profiles?.name || "Peer Tutor"}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Waiting for connection…</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
                {remoteConnected ? (remoteName || "Remote") : "Not Connected"}
              </div>
            </div>
          </div>

          {/* AV Controls Floating Dock */}
          <div className="h-auto min-h-12 bg-secondary/80 backdrop-blur-md rounded-xl border border-border/60 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-center gap-2 sm:gap-3 shrink-0">
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMic}
              className="h-8 text-xs gap-1.5"
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isMuted ? "Unmute" : "Mute"}
            </Button>

            <Button
              size="sm"
              variant={isVideoOff ? "destructive" : "secondary"}
              onClick={toggleVideo}
              className="h-8 text-xs gap-1.5"
            >
              {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              {isVideoOff ? "Start Video" : "Stop Video"}
            </Button>

            <Button
              size="sm"
              variant={isScreenSharing ? "destructive" : "secondary"}
              onClick={toggleScreenShare}
              className="h-8 text-xs gap-1.5"
            >
              <ScreenShare className="w-3.5 h-3.5" />
              {isScreenSharing ? "Stop Sharing" : "Share Screen"}
            </Button>
          </div>
        </div>

        {/* Right Sidebar: Real-time Lesson Chat (4 or 3 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-full overflow-hidden">
          <Card className="flex-1 glass-card border-border/60 flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-primary" />
                Lesson Chat
              </span>
              <span className="text-[10px] text-muted-foreground">In-Session</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <p className="text-xs text-muted-foreground">
                    Ask questions or paste equations in this chat.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`space-y-1 ${msg.senderId === user?.id ? "text-right" : "text-left"}`}
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {msg.senderName} • {msg.time}
                    </span>
                    <div
                      className={`p-2.5 rounded-xl text-xs inline-block max-w-[85%] break-words ${
                        msg.senderId === user?.id
                          ? "bg-primary text-primary-foreground text-left"
                          : "bg-secondary text-foreground text-left border border-border/40"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-2.5 border-t border-border/40 flex items-center gap-2">
              <Input
                placeholder="Type message or formula..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="h-9 text-xs bg-secondary/50 border-border/50"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                className="h-9 w-9 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* POST-SESSION RATING MODAL */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="glass-card border-border/80 max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Rate Your Tutoring Session
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              How was your lesson with {booking?.tutor_profiles?.profiles?.name}? Your review helps maintain top educational standards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Star Rating Selector */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingScore(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= ratingScore ? "text-accent fill-accent" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              placeholder="What did you learn? How clear was the tutor's explanation?"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="bg-secondary/40 text-xs min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setReviewModalOpen(false);
                navigate("/tutors");
              }}
              className="border-border/60 text-xs"
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {isSubmittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

