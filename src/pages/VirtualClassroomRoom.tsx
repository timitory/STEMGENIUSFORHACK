import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video, VideoOff, Mic, MicOff, Share2, Hand, MessageSquare,
  HelpCircle, Users, LogOut, Radio, ThumbsUp, Send, CheckCircle2,
  AlertCircle, Sparkles, Loader2, Volume2, Maximize2, ShieldCheck,
  Disc, Info, ChevronRight, X, Lock, KeyRound, FileUp, Download, Square, ScreenShare
} from "lucide-react";
import { toast } from "sonner";
import {
  createPeerConnection,
  createMeetingRecordingStream,
  fetchIceServers,
  type IceServerConfig,
  type ConnectionDiagnostics,
} from "@/lib/webrtcService";
import {
  fetchClassByRoomId,
  trackAttendanceJoin,
  fetchClassQA,
  submitClassQuestion,
  upvoteClassQA,
  answerClassQA,
  toggleRaiseHand,
  fetchHandRaises,
  approveHandRaise,
  removeHandRaise,
  updateClassStatus,
  endClassAndGenerateRecording,
  submitPreJoinAnswer,
} from "@/lib/virtualClassService";
import { VirtualClass, ClassQAItem, ClassHandRaise } from "@/types/virtualClasses";
import { ZoomMeetingEmbed } from "@/components/virtualClass/ZoomMeetingEmbed";

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole?: string;
  text: string;
  time: string;
  isHost?: boolean;
}

/**
 * Renders a single remote WebRTC participant tile.
 * Uses a ref callback to attach the MediaStream to the <video> element
 * whenever it mounts, since React state updates cause re-mounts.
 */
function RemotePeerTile({
  peer,
}: {
  peer: { userId: string; name: string; stream: MediaStream; isHost?: boolean };
}) {
  const videoRef = (el: HTMLVideoElement | null) => {
    if (el && peer.stream) {
      if (el.srcObject !== peer.stream) {
        el.srcObject = peer.stream;
        el.play().catch(() => {});
      }
    }
  };

  const hasVideo = peer.stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div className="relative w-40 h-28 bg-slate-900 rounded-xl border border-border/60 overflow-hidden shadow-lg shrink-0">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center text-primary font-bold text-sm">
            {peer.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      {/* Hidden audio element so we hear the remote participant */}
      <audio
        ref={(el) => {
          if (el && peer.stream && el.srcObject !== peer.stream) {
            el.srcObject = peer.stream;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
      />
      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white truncate max-w-[90%]">
        {peer.name}
        {peer.isHost && " (Host)"}
      </div>
    </div>
  );
}

export default function VirtualClassroomRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasscodeVerified, setIsPasscodeVerified] = useState(true);
  const [passcodeAttempt, setPasscodeAttempt] = useState("");

  // Pre-join attendee intake question state
  const [preJoinModalOpen, setPreJoinModalOpen] = useState(false);
  const [preJoinAnswer, setPreJoinAnswer] = useState("");
  const [isSubmittingPreJoin, setIsSubmittingPreJoin] = useState(false);

  // Participant roles & states
  const [isHost, setIsHost] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false); // Host approved hand raise

  // Media streams
  const [videoActive, setVideoActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // WebRTC Mesh Peer Connections & Remote Streams
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const iceConfigRef = useRef<IceServerConfig | null>(null);
  const [peerDiagnostics, setPeerDiagnostics] = useState<Map<string, ConnectionDiagnostics>>(new Map());
  const [remotePeers, setRemotePeers] = useState<Array<{
    userId: string;
    name: string;
    stream: MediaStream;
    isHost?: boolean;
    canSpeak?: boolean;
    isScreenSharing?: boolean;
  }>>([]);
  const [activeScreenSharer, setActiveScreenSharer] = useState<{ userId: string; name: string } | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);

  // Real-time Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Q&A System
  const [qaItems, setQaItems] = useState<ClassQAItem[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState("");

  // Hand raise queue (Host view)
  const [handRaises, setHandRaises] = useState<ClassHandRaise[]>([]);

  // Active side panel
  const [activeTab, setActiveTab] = useState<"chat" | "qa" | "queue">("chat");

  // Load session & room
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadClassData(session.user.id);
    });

    return () => {
      // Cleanup media tracks on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, navigate]);

  const loadClassData = async (userId: string) => {
    if (!roomId) return;
    try {
      setLoading(true);
      const [userProfile, cls] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        fetchClassByRoomId(roomId, userId),
      ]);

      if (userProfile.data) setProfile(userProfile.data);

      if (!cls) {
        toast.error("Classroom session not found");
        navigate("/virtual-classes");
        return;
      }

      setVirtualClass(cls);

      // Check if user is host or co-host
      const isUserHost = cls.host_id === userId || cls.co_host_ids?.includes(userId);
      setIsHost(isUserHost);

      // Passcode validation
      if (cls.passcode && !isUserHost) {
        const storedPasscode = sessionStorage.getItem(`passcode_class_${cls.id}`);
        if (storedPasscode === cls.passcode) {
          setIsPasscodeVerified(true);
        } else {
          setIsPasscodeVerified(false);
        }

        // Check if pre-join question is set and user is attendee
        if (cls.pre_join_question && !isUserHost) {
          const sessionKey = `pre_join_${cls.id}_${userId}`;
          const alreadyAnswered = sessionStorage.getItem(sessionKey);
          if (!alreadyAnswered) {
            const { data: reg } = await supabase
              .from("class_registrations")
              .select("pre_join_answer")
              .eq("class_id", cls.id)
              .eq("user_id", userId)
              .maybeSingle();

            if (!reg || !reg.pre_join_answer) {
              setPreJoinModalOpen(true);
            }
          }
        }
      } else {
        setIsPasscodeVerified(true);
      }

      // Track attendance
      await trackAttendanceJoin(cls.id, userId);

      // Load Q&A
      const qa = await fetchClassQA(cls.id);
      setQaItems(qa);

      // If host, load hand raise queue
      if (isUserHost) {
        const raises = await fetchHandRaises(cls.id);
        setHandRaises(raises);
      }

      // Initial chat welcome
      setMessages([
        {
          id: "welcome-1",
          senderName: "System",
          text: `Welcome to "${cls.title}". This webinar is configured for high-concurrency broadcast. Microphones are muted for attendees by default. Use "Raise Hand" or "Q&A" to interact with the host.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: "welcome-2",
          senderName: cls.host?.name || "Host",
          senderRole: "Host",
          isHost: true,
          text: cls.host_announcements || "Welcome everyone! Feel free to post your questions in the Q&A panel.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Initial connected count
      setAttendeeCount(1);
    } catch (err) {
      console.error("Error loading classroom:", err);
      toast.error("Failed to connect to virtual room");
    } finally {
      setLoading(false);
    }
  };

  // Setup Supabase Realtime channel with Presence and broadcast sync
  useEffect(() => {
    if (!virtualClass) return;

    // Fetch TURN + STUN ICE config from backend before setting up any peer connections.
    // We do this once per room join; the result is cached in webrtcService.
    fetchIceServers().then((cfg) => {
      iceConfigRef.current = cfg;
      console.info(
        `[Webinar] ICE servers ready — hasTurn=${cfg.hasTurn}, count=${cfg.iceServers.length}`
      );
    });

    const channelName = `webinar-${virtualClass.id}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user?.id || crypto.randomUUID() } },
    });
    channelRef.current = channel;

    // Helper to setup a peer connection to a remote participant
    const getOrCreatePeerConnection = (remoteUserId: string, remoteUserName: string) => {
      let pc = peerConnectionsRef.current.get(remoteUserId);
      if (!pc || pc.connectionState === "closed") {
        pc = createPeerConnection(
          remoteUserId,
          localStreamRef.current,
          (track, stream) => {
            remoteStreamsRef.current.set(remoteUserId, stream);
            setRemotePeers(prev => {
              const existing = prev.filter(p => p.userId !== remoteUserId);
              return [...existing, {
                userId: remoteUserId,
                name: remoteUserName,
                stream,
                isHost: virtualClass.host_id === remoteUserId,
              }];
            });
          },
          (candidate) => {
            channel.send({
              type: "broadcast",
              event: "webrtc_ice_candidate",
              payload: { fromUserId: user.id, toUserId: remoteUserId, candidate },
            });
          },
          (state) => {
            if (state === "disconnected" || state === "failed") {
              // Connection degraded — remove tile and log; cleanup happens on "closed"
              console.warn(`[Webinar] Peer ${remoteUserId} connection state: ${state}`);
            }
            if (state === "closed") {
              peerConnectionsRef.current.delete(remoteUserId);
              remoteStreamsRef.current.delete(remoteUserId);
              setRemotePeers(prev => prev.filter(p => p.userId !== remoteUserId));
            }
          },
          iceConfigRef.current ?? undefined,
        );
        peerConnectionsRef.current.set(remoteUserId, pc);
      }
      return pc;
    };

    // WebRTC Signalling Handlers
    channel
      .on("broadcast", { event: "webrtc_peer_join" }, async ({ payload }) => {
        if (!user || payload.userId === user.id) return;
        // Every authenticated participant negotiates with the joining peer so
        // they can receive that peer's audio/video (host, speaker, or attendee).
        // The joining peer's permission level is checked server-side via Supabase RLS;
        // here we simply ensure the local peer connection and media exchange is set up.
        const pc = getOrCreatePeerConnection(payload.userId, payload.name);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "webrtc_offer",
            payload: {
              fromUserId: user.id,
              toUserId: payload.userId,
              name: profile?.name || "Participant",
              sdp: offer,
            },
          });
        } catch (err) {
          console.warn("Error creating WebRTC offer:", err);
        }
      })
      .on("broadcast", { event: "webrtc_offer" }, async ({ payload }) => {
        if (!user || payload.toUserId !== user.id) return;
        const pc = getOrCreatePeerConnection(payload.fromUserId, payload.name);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "webrtc_answer",
            payload: { fromUserId: user.id, toUserId: payload.fromUserId, sdp: answer },
          });
        } catch (err) {
          console.warn("Error handling WebRTC offer:", err);
        }
      })
      .on("broadcast", { event: "webrtc_answer" }, async ({ payload }) => {
        if (!user || payload.toUserId !== user.id) return;
        const pc = peerConnectionsRef.current.get(payload.fromUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } catch (err) {
            console.warn("Error setting remote answer:", err);
          }
        }
      })
      .on("broadcast", { event: "webrtc_ice_candidate" }, async ({ payload }) => {
        if (!user || payload.toUserId !== user.id) return;
        const pc = peerConnectionsRef.current.get(payload.fromUserId);
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.warn("Error adding ICE candidate:", err);
          }
        }
      })
      .on("broadcast", { event: "screen_share_status" }, ({ payload }) => {
        if (payload.isSharing) {
          setActiveScreenSharer({ userId: payload.userId, name: payload.userName });
        } else {
          setActiveScreenSharer(null);
        }
      })

    // Real Presence tracking
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const activeCount = Object.keys(state).length;
      setAttendeeCount(Math.max(1, activeCount));
      if (isHost && activeCount > (virtualClass.peak_participants || 0)) {
        supabase
          .from("virtual_classes")
          .update({ peak_participants: activeCount })
          .eq("id", virtualClass.id)
          .then();
      }
    })
    .on("broadcast", { event: "recording_status" }, ({ payload }) => {
      setIsRecording(payload.isRecording);
    })
    .on("broadcast", { event: "resource_updated" }, ({ payload }) => {
      setVirtualClass(prev => prev ? { ...prev, presentation_slides_url: payload.resourceUrl } : null);
      toast.info("Host shared class notes: " + payload.fileName);
    })

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload]);
      })
      .on("broadcast", { event: "hand_raise_updated" }, async () => {
        if (isHost) {
          const updated = await fetchHandRaises(virtualClass.id);
          setHandRaises(updated);
        }
      })
      .on("broadcast", { event: "hand_raise_status" }, ({ payload }) => {
        if (user && payload.userId === user.id) {
          if (payload.isApproved) {
            setCanSpeak(true);
            toast.success("The host invited you to speak! Your microphone is now enabled.", {
              duration: 8000,
            });
          } else {
            setCanSpeak(false);
            setMicActive(false);
            toast.info("Speaking permission ended by host.");
          }
        }
      })
      .on("broadcast", { event: "class_status_changed" }, ({ payload }) => {
        if (payload.status === "ended") {
          toast.info("The host has concluded this live class.");
          navigate(`/virtual-classes/summary/${virtualClass.room_id}`);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await channel.track({
            userId: user.id,
            joinedAt: new Date().toISOString(),
          });
          // Announce peer join to trigger WebRTC negotiation
          channel.send({
            type: "broadcast",
            event: "webrtc_peer_join",
            payload: { userId: user.id, name: profile?.name || "Participant", isHost, canSpeak },
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      // Close all peer connections and clear state
      peerConnectionsRef.current.forEach((pc) => {
        try { pc.close(); } catch (_) {}
      });
      peerConnectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      setRemotePeers([]);
    };
  }, [virtualClass, isHost, user, navigate]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Host & Interactive Participant Video & Audio Controls
  const isInteractive = virtualClass?.meeting_format === "interactive_meeting";
  const canUseMedia = isHost || canSpeak || isInteractive;

  // Helper: attach / refresh the video element srcObject and call play()
  const attachVideoStream = (stream: MediaStream | null) => {
    if (!videoRef.current) return;
    // Always re-assign srcObject — browsers need this to detect track changes
    videoRef.current.srcObject = stream;
    if (stream) {
      videoRef.current.play().catch((err) => {
        // play() rejection is normal when muted/autoPlay handles it; suppress DOMException
        if (err.name !== "AbortError") console.warn("Video play() rejected:", err);
      });
    }
  };

  const toggleVideo = async () => {
    if (!canUseMedia) {
      toast.error("Audience cameras are disabled for this broadcast. Raise Hand to request speaking access.");
      return;
    }

    if (videoActive) {
      // Turn camera off: stop video tracks and detach from stream
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }
      setVideoActive(false);
      // If mic is also off, clear the video element
      if (!micActive) {
        attachVideoStream(null);
      }
      toast.info("Camera turned off");
    } else {
      try {
        let camStream: MediaStream;
        try {
          camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          });
        } catch {
          camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        const videoTrack = camStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        // Remove any stale video tracks first
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current!.removeTrack(t);
        });
        localStreamRef.current.addTrack(videoTrack);

        // Re-assign srcObject so the browser picks up the new track
        attachVideoStream(localStreamRef.current);
        setVideoActive(true);
        toast.success("Camera started");
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          toast.error("Camera permission denied. Please allow camera access in browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          toast.error("No camera detected on your device.");
        } else {
          toast.error(`Camera error: ${err.message || "Device busy or unavailable"}`);
        }
      }
    }
  };

  const toggleMic = async () => {
    if (!canUseMedia) {
      toast.error("Microphones are currently muted. Please Raise Hand to speak.");
      return;
    }

    if (micActive) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setMicActive(false);
      toast.info("Microphone muted");
    } else {
      try {
        const existingAudioTracks = localStreamRef.current?.getAudioTracks() || [];
        if (existingAudioTracks.length > 0) {
          existingAudioTracks.forEach((track) => (track.enabled = true));
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          const audioTrack = stream.getAudioTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(audioTrack);
          } else {
            localStreamRef.current = new MediaStream([audioTrack]);
          }
        }
        setMicActive(true);
        toast.success("Microphone unmuted");
      } catch (err: any) {
        console.error("Microphone access error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          toast.error("Microphone permission denied. Please allow microphone access in browser settings.");
        } else {
          toast.error(`Microphone unavailable: ${err.message || "Check device connection"}`);
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isHost && !canSpeak) {
      toast.error("Only authorized presenters can share screen.");
      return;
    }

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      setActiveScreenSharer(null);

      // Revert video track in peer connections to webcam if camera is active
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
        }
      });

      if (videoRef.current && localStreamRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
      }

      channelRef.current?.send({
        type: "broadcast",
        event: "screen_share_status",
        payload: { isSharing: false, userId: user.id },
      });
      toast.info("Screen sharing ended.");
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all active WebRTC peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          } else {
            pc.addTrack(screenVideoTrack, screenStream);
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.play().catch(console.warn);
        }
        setIsScreenSharing(true);
        setActiveScreenSharer({ userId: user.id, name: profile?.name || "Host" });

        // Handle user clicking native browser "Stop sharing" button
        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };

        channelRef.current?.send({
          type: "broadcast",
          event: "screen_share_status",
          payload: { isSharing: true, userId: user.id, userName: profile?.name || "Host" },
        });

        toast.success("Screen sharing started! All participants see your screen live.");
      } catch (err: any) {
        if (err.name !== "NotAllowedError") {
          console.error("Screen share error:", err);
          toast.error("Screen share failed: " + (err.message || "Unknown error"));
        }
      }
    }
  };

  // Attendee Raise Hand
  const handleToggleHandRaise = async () => {
    if (!virtualClass || !user) return;
    try {
      const isNowRaised = await toggleRaiseHand(virtualClass.id, user.id, handRaised);
      setHandRaised(isNowRaised);
      if (isNowRaised) {
        toast.success("Hand raised! You are in the speaker queue.");
      } else {
        toast.info("Hand lowered.");
      }

      // Broadcast update to host
      supabase.channel(`webinar-${virtualClass.id}`).send({
        type: "broadcast",
        event: "hand_raise_updated",
        payload: { userId: user.id },
      });
    } catch {
      toast.error("Failed to update hand raise");
    }
  };

  // Host: Approve or reject hand raise
  const handleApproveSpeaker = async (raise: ClassHandRaise, approve: boolean) => {
    if (!virtualClass) return;
    try {
      await approveHandRaise(raise.id, approve);
      setHandRaises((prev) =>
        prev.map((r) => (r.id === raise.id ? { ...r, is_approved: approve } : r))
      );

      // Notify attendee directly
      supabase.channel(`webinar-${virtualClass.id}`).send({
        type: "broadcast",
        event: "hand_raise_status",
        payload: { userId: raise.user_id, isApproved: approve },
      });

      toast.success(approve ? `Granted microphone to ${raise.user?.name || "attendee"}` : "Revoked microphone access");
    } catch {
      toast.error("Failed to update speaker permissions");
    }
  };

  const handleDismissSpeaker = async (raiseId: string) => {
    try {
      await removeHandRaise(raiseId);
      setHandRaises((prev) => prev.filter((r) => r.id !== raiseId));
    } catch {
      toast.error("Failed to dismiss speaker");
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || !virtualClass) return;

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderName: profile?.name || "Anonymous Student",
      senderRole: isHost ? "Host" : undefined,
      isHost,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatInput("");
    setMessages((prev) => [...prev, newMsg]);

    // Broadcast to room
    supabase.channel(`webinar-${virtualClass.id}`).send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });
  };

  // Q&A actions
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || !user || !virtualClass) return;

    try {
      const q = await submitClassQuestion(virtualClass.id, user.id, questionInput.trim());
      if (q) {
        setQaItems((prev) => [q, ...prev]);
        setQuestionInput("");
        toast.success("Question submitted to moderator queue!");
      }
    } catch {
      toast.error("Failed to submit question");
    }
  };

  const handleUpvote = async (qId: string) => {
    try {
      await upvoteClassQA(qId);
      setQaItems((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, upvotes_count: q.upvotes_count + 1 } : q))
      );
    } catch {
      toast.error("Failed to upvote question");
    }
  };

  const handleAnswerSubmit = async (qId: string) => {
    if (!answerInput.trim() || !user || !virtualClass) return;
    try {
      await answerClassQA(qId, answerInput.trim(), profile?.name || "Host");
      setQaItems((prev) =>
        prev.map((q) =>
          q.id === qId
            ? { ...q, is_answered: true, answer_text: answerInput.trim(), answered_by: profile?.name }
            : q
        )
      );
      setAnsweringId(null);
      setAnswerInput("");
      toast.success("Answer published!");
    } catch {
      toast.error("Failed to post answer");
    }
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startLiveRecording = () => {
    if (!isHost) return;
    try {
      recordedChunksRef.current = [];

      // Collect all active audio tracks: host local microphone + all remote participants
      const allAudioTracks: MediaStreamTrack[] = [
        ...(localStreamRef.current?.getAudioTracks() || []),
      ];
      remoteStreamsRef.current.forEach((stream) => {
        allAudioTracks.push(...stream.getAudioTracks());
      });

      // Active video track: screen share if active, or local camera
      const activeVideoTrack = isScreenSharing
        ? screenStreamRef.current?.getVideoTracks()[0]
        : localStreamRef.current?.getVideoTracks()[0] || null;

      const { stream: compositeStream } = createMeetingRecordingStream(
        activeVideoTrack || null,
        allAudioTracks
      );

      if (compositeStream.getTracks().length === 0) {
        toast.error("Please turn on your camera, microphone, or screen share before recording.");
        return;
      }

      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "video/webm";

      const rec = new MediaRecorder(compositeStream, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      rec.start(1000);
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      channelRef.current?.send({
        type: "broadcast",
        event: "recording_status",
        payload: { isRecording: true },
      });

      toast.success("Live Recording started! Capturing host, attendees, and presentation.");
    } catch (err: any) {
      console.error("Recording start error:", err);
      toast.error("Failed to start recording: " + (err.message || "MediaRecorder error"));
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);

    supabase.channel(`webinar-${virtualClass?.id}`).send({
      type: "broadcast",
      event: "recording_status",
      payload: { isRecording: false },
    });

    toast.info("Recording stopped. It will be uploaded automatically when you end class.");
  };

  const handleUploadClassResource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !virtualClass) return;
    setIsUploadingResource(true);
    try {
      toast.loading("Uploading class resources...");
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${virtualClass.id}/${Date.now()}_${cleanName}`;
      const { error: uploadErr } = await supabase.storage
        .from("class-resources")
        .upload(filePath, file, { contentType: file.type || "application/pdf", upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from("class-resources")
        .getPublicUrl(filePath);

      await supabase
        .from("virtual_classes")
        .update({ presentation_slides_url: pubData.publicUrl })
        .eq("id", virtualClass.id);

      setVirtualClass((prev) => prev ? { ...prev, presentation_slides_url: pubData.publicUrl } : null);

      supabase.channel(`webinar-${virtualClass.id}`).send({
        type: "broadcast",
        event: "resource_updated",
        payload: { resourceUrl: pubData.publicUrl, fileName: file.name },
      });

      toast.dismiss();
      toast.success("Class notes/slides shared with all attendees!");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Resource upload failed: " + err.message);
    } finally {
      setIsUploadingResource(false);
    }
  };

  // Host: Conclude Class & Save Recording
  const handleEndClass = async () => {
    if (!virtualClass) return;
    if (!confirm("Are you sure you want to end this live webinar for all attendees?")) {
      return;
    }

    try {
      toast.loading("Ending webinar and saving session...");

      let realRecordingUrl: string | undefined = undefined;
      let realFileSize: number | undefined = undefined;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        await new Promise((r) => setTimeout(r, 400));
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (recordedChunksRef.current.length > 0) {
        toast.loading("Uploading high-definition recording...");
        const finalBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        realFileSize = finalBlob.size;
        const filePath = `${virtualClass.id}/${Date.now()}_recording.webm`;
        const { error: uploadError } = await supabase.storage
          .from("class-recordings")
          .upload(filePath, finalBlob, { contentType: "video/webm", upsert: false });

        if (!uploadError) {
          const { data: pubData } = supabase.storage
            .from("class-recordings")
            .getPublicUrl(filePath);
          realRecordingUrl = pubData.publicUrl;
        }
      }

      await endClassAndGenerateRecording(
        virtualClass.id,
        virtualClass.title,
        recordingSeconds,
        realRecordingUrl,
        realFileSize
      );

      // Broadcast ended event
      supabase.channel(`webinar-${virtualClass.id}`).send({
        type: "broadcast",
        event: "class_status_changed",
        payload: { status: "ended" },
      });

      toast.dismiss();
      toast.success("Webinar concluded successfully!");
      navigate(`/virtual-classes/summary/${virtualClass.room_id}`);
    } catch (err: any) {
      toast.dismiss();
      toast.error("Failed to conclude class: " + (err.message || "Unknown error"));
    }
  };

  if (loading || !virtualClass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Joining virtual masterclass room...</p>
        </div>
      </div>
    );
  }

  if (!isPasscodeVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 glass-card border-border/80 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Passcode-Protected Session</h2>
            <p className="text-xs text-muted-foreground mt-1">
              "{virtualClass.title}" requires an access passcode to participate.
            </p>
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              type="text"
              placeholder="Enter meeting passcode"
              value={passcodeAttempt}
              onChange={(e) => setPasscodeAttempt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (passcodeAttempt.trim() === (virtualClass.passcode || "").trim()) {
                    sessionStorage.setItem(`passcode_class_${virtualClass.id}`, passcodeAttempt.trim());
                    setIsPasscodeVerified(true);
                  } else {
                    toast.error("Incorrect passcode");
                  }
                }
              }}
              className="pl-9 bg-secondary/40 text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/virtual-classes")}
              className="flex-1 border-border/60 text-xs"
            >
              Back to Hub
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (passcodeAttempt.trim() === (virtualClass.passcode || "").trim()) {
                  sessionStorage.setItem(`passcode_class_${virtualClass.id}`, passcodeAttempt.trim());
                  setIsPasscodeVerified(true);
                } else {
                  toast.error("Incorrect passcode");
                }
              }}
              disabled={!passcodeAttempt.trim()}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              Unlock Room
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden text-foreground">
      {/* TOP BAR / HEADER */}
      <header className="h-14 border-b border-border/60 bg-card/60 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-destructive text-destructive-foreground animate-pulse text-[10px] font-bold px-2 py-0.5">
              ● LIVE WEBINAR
            </Badge>
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px] hidden sm:inline-flex">
              {virtualClass.subject}
            </Badge>
          </div>

          <div className="h-4 w-px bg-border/60 hidden sm:block" />

          <div>
            <h1 className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
              {virtualClass.title}
            </h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Host: {virtualClass.host?.name || "Verified Educator"} • Max Capacity: {virtualClass.max_capacity}
            </p>
          </div>
        </div>

        {/* Live Metrics, Resources & Exit */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Class Resources (Host upload or Attendee download) */}
          {isHost ? (
            <div>
              <input
                ref={resourceInputRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.doc,.docx"
                onChange={handleUploadClassResource}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isUploadingResource}
                onClick={() => resourceInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 border-border/60"
                title="Share presentation slides or notes PDF"
              >
                {isUploadingResource ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5 text-accent" />}
                <span className="hidden sm:inline">Upload Notes</span>
              </Button>
            </div>
          ) : (
            virtualClass.presentation_slides_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs h-8 gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
              >
                <a href={virtualClass.presentation_slides_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download Notes</span>
                </a>
              </Button>
            )
          )}

          {/* Recording Controls */}
          {isHost ? (
            isRecording ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 border border-destructive/40 text-destructive text-xs font-mono animate-pulse">
                  <Disc className="w-3.5 h-3.5 animate-spin" />
                  <span>REC {formatRecordingTime(recordingSeconds)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopLiveRecording}
                  className="text-xs h-8 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span className="hidden sm:inline">Stop Rec</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={startLiveRecording}
                className="text-xs h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Disc className="w-3.5 h-3.5 text-destructive" />
                <span className="hidden sm:inline">Start Recording</span>
              </Button>
            )
          ) : (
            isRecording && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[11px] font-mono">
                <Disc className="w-3.5 h-3.5 animate-spin" />
                <span className="font-semibold">REC</span>
              </div>
            )
          )}

          {/* Connected Attendees from Realtime Presence */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-mono" title="Live connected participants">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{attendeeCount}</span>
          </div>

          {/* End/Leave Button */}
          {isHost ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEndClass}
              className="text-xs h-8 gap-1.5 font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              End Class
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/virtual-classes")}
              className="text-xs h-8 gap-1.5 border-border/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave Room
            </Button>
          )}
        </div>
      </header>

      {/* ANNOUNCEMENT BANNER */}
      {virtualClass.host_announcements && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 text-xs text-primary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="font-semibold truncate">Host Announcement:</span>
            <span className="truncate">{virtualClass.host_announcements}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER: STAGE & MEDIA DISPLAY */}
        <div className="flex-1 flex flex-col bg-slate-950 p-3 sm:p-4 relative overflow-hidden">
          {/* ZOOM MEETING STAGE CONTAINER */}
          <div className="flex-1 w-full rounded-2xl overflow-hidden bg-black/90 border border-border/40 relative flex items-center justify-center shadow-2xl">
            <ZoomMeetingEmbed
              virtualClass={virtualClass}
              isHost={isHost}
              onLeave={() => isHost ? handleEndClass() : navigate("/virtual-classes")}
            />
          </div>

          {/* BOTTOM CONTROLS DOCK */}
          <div className="min-h-14 shrink-0 mt-3 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2 rounded-2xl bg-card/80 backdrop-blur-lg border border-border/60 shadow-lg">
            {/* Left Controls: Audio / Video */}
            <div className="flex items-center gap-2">
              {(isHost || canSpeak || isInteractive) ? (
                <>
                  <Button
                    size="sm"
                    variant={micActive ? "default" : "secondary"}
                    onClick={toggleMic}
                    className={`h-10 px-3.5 rounded-xl gap-2 font-semibold text-xs ${
                      micActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span className="hidden sm:inline">{micActive ? "Mute" : "Unmute"}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant={videoActive ? "default" : "secondary"}
                    onClick={toggleVideo}
                    className={`h-10 px-3.5 rounded-xl gap-2 font-semibold text-xs ${
                      videoActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {videoActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span className="hidden sm:inline">{videoActive ? "Stop Video" : "Start Video"}</span>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-2 rounded-xl">
                  <MicOff className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="hidden sm:inline">Audience Muted</span>
                </div>
              )}

              {/* Screen Share (Host Only) */}
              {isHost && (
                <Button
                  size="sm"
                  variant={isScreenSharing ? "default" : "outline"}
                  onClick={toggleScreenShare}
                  className={`h-10 px-3.5 rounded-xl gap-2 text-xs border-border/60 ${
                    isScreenSharing ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden md:inline">{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                </Button>
              )}
            </div>

            {/* Center Controls: Attendee Hand Raise */}
            <div className="flex items-center gap-2">
              {!isHost && (
                <Button
                  size="sm"
                  variant={handRaised ? "default" : "outline"}
                  onClick={handleToggleHandRaise}
                  className={`h-10 px-4 rounded-xl gap-2 text-xs font-bold transition-all ${
                    handRaised
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                      : "border-border/60 hover:border-amber-500/40 text-foreground"
                  }`}
                >
                  <Hand className={`w-4 h-4 ${handRaised ? "animate-bounce" : ""}`} />
                  <span>{handRaised ? "Hand Raised (In Queue)" : "Raise Hand"}</span>
                </Button>
              )}
            </div>

            {/* Right Controls: Tab Switchers for Mobile/Drawer */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={activeTab === "chat" ? "default" : "ghost"}
                onClick={() => setActiveTab("chat")}
                className="h-10 w-10 p-0 rounded-xl relative"
                title="Live Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant={activeTab === "qa" ? "default" : "ghost"}
                onClick={() => setActiveTab("qa")}
                className="h-10 w-10 p-0 rounded-xl relative"
                title="Q&A"
              >
                <HelpCircle className="w-4 h-4" />
                {qaItems.filter((q) => !q.is_answered).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center font-bold">
                    {qaItems.filter((q) => !q.is_answered).length}
                  </span>
                )}
              </Button>

              {isHost && (
                <Button
                  size="sm"
                  variant={activeTab === "queue" ? "default" : "ghost"}
                  onClick={() => setActiveTab("queue")}
                  className="h-10 w-10 p-0 rounded-xl relative"
                  title="Speaker Queue"
                >
                  <Hand className="w-4 h-4" />
                  {handRaises.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center font-bold">
                      {handRaises.length}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: INTERACTIVE PANEL (CHAT / Q&A / QUEUE) */}
        <div className="w-80 md:w-96 border-l border-border/60 bg-card/60 backdrop-blur-md flex flex-col shrink-0">
          {/* Panel Header */}
          <div className="p-3 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={activeTab === "chat" ? "secondary" : "ghost"}
                onClick={() => setActiveTab("chat")}
                className="text-xs h-8 px-2.5 gap-1.5 font-semibold"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </Button>
              <Button
                size="sm"
                variant={activeTab === "qa" ? "secondary" : "ghost"}
                onClick={() => setActiveTab("qa")}
                className="text-xs h-8 px-2.5 gap-1.5 font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Q&A ({qaItems.length})
              </Button>
              {isHost && (
                <Button
                  size="sm"
                  variant={activeTab === "queue" ? "secondary" : "ghost"}
                  onClick={() => setActiveTab("queue")}
                  className="text-xs h-8 px-2.5 gap-1.5 font-semibold"
                >
                  <Hand className="w-3.5 h-3.5" />
                  Queue ({handRaises.length})
                </Button>
              )}
            </div>
          </div>

          {/* TAB 1: LIVE CHAT */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 text-xs space-y-1 ${
                      msg.isHost
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "bg-secondary/70 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold flex items-center gap-1">
                        {msg.senderName}
                        {msg.isHost && (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] py-0 px-1">
                            HOST
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground font-mono">{msg.time}</span>
                    </div>
                    <p className="leading-relaxed text-xs break-words">{msg.text}</p>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/60 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message to class..."
                  className="text-xs h-9 bg-background/80"
                />
                <Button type="submit" size="sm" className="h-9 px-3 bg-primary text-primary-foreground">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          )}

          {/* TAB 2: MODERATED LIVE Q&A */}
          {activeTab === "qa" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {qaItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground space-y-2">
                    <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground/30" />
                    <p className="text-xs">No questions yet. Ask something below!</p>
                  </div>
                ) : (
                  qaItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-secondary/70 border border-border/40 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground text-[11px]">
                          {item.user?.name || "Student"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpvote(item.id)}
                          className="h-6 px-2 text-[10px] gap-1 hover:text-primary"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>{item.upvotes_count}</span>
                        </Button>
                      </div>

                      <p className="text-xs text-foreground leading-relaxed">{item.question_text}</p>

                      {/* Display Answer if present */}
                      {item.is_answered && item.answer_text ? (
                        <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] space-y-1">
                          <div className="flex items-center gap-1 font-bold text-primary">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Answer from {item.answered_by || "Host"}:</span>
                          </div>
                          <p className="text-muted-foreground">{item.answer_text}</p>
                        </div>
                      ) : isHost ? (
                        <div className="pt-1">
                          {answeringId === item.id ? (
                            <div className="space-y-1.5 pt-1">
                              <Input
                                value={answerInput}
                                onChange={(e) => setAnswerInput(e.target.value)}
                                placeholder="Type answer for class..."
                                className="text-xs h-8"
                              />
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAnsweringId(null)}
                                  className="h-7 text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAnswerSubmit(item.id)}
                                  className="h-7 text-xs bg-primary text-primary-foreground"
                                >
                                  Post Answer
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAnsweringId(item.id)}
                              className="text-[10px] h-6 px-2 border-primary/30 text-primary"
                            >
                              Answer Live
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {/* Submit Question Form */}
              <form onSubmit={handleAskQuestion} className="p-3 border-t border-border/60 flex gap-2">
                <Input
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a question for the speaker..."
                  className="text-xs h-9 bg-background/80"
                />
                <Button type="submit" size="sm" className="h-9 px-3 bg-primary text-primary-foreground">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          )}

          {/* TAB 3: SPEAKER QUEUE (HOST ONLY) */}
          {activeTab === "queue" && isHost && (
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              <h4 className="text-xs font-bold text-foreground">
                Raised Hands Queue ({handRaises.length})
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Grant audience members speaking permissions one at a time.
              </p>

              {handRaises.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <Hand className="w-8 h-8 mx-auto text-muted-foreground/30" />
                  <p className="text-xs">No attendees currently have their hand raised.</p>
                </div>
              ) : (
                handRaises.map((raise) => (
                  <Card key={raise.id} className="p-3 glass-card border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">
                        {raise.user?.name || "Student"}
                      </span>
                      {raise.is_approved ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                          Speaking Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-[10px]">
                          Waiting
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {raise.is_approved ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleApproveSpeaker(raise, false)}
                          className="h-7 text-xs flex-1"
                        >
                          Revoke Mic
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleApproveSpeaker(raise, true)}
                          className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          Allow to Speak
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismissSpeaker(raise.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

