import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { X, Send, Users, Mic, MicOff, Video, VideoOff, Share2, Gift, Crown, UserPlus, Hand, Loader2, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { fetchIceServers } from "@/lib/webrtcService";

interface Participant { id: string; user_id: string; joined_at: string; profiles?: { name: string }; }
interface Speaker { id: string; user_id: string; is_approved: boolean; profiles?: { name: string }; }

const GIFT_OPTIONS = [
  { emoji: "🎁", name: "Gift", cost: 10 },
  { emoji: "⭐", name: "Star", cost: 20 },
  { emoji: "🔥", name: "Fire", cost: 30 },
  { emoji: "💎", name: "Diamond", cost: 50 },
  { emoji: "👑", name: "Crown", cost: 100 },
  { emoji: "🚀", name: "Rocket", cost: 200 },
  { emoji: "🎉", name: "Party", cost: 150 },
  { emoji: "💝", name: "Heart", cost: 75 },
];

const LiveStream = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [hasRequestedToSpeak, setHasRequestedToSpeak] = useState(false);
  const [gifts, setGifts] = useState<{ type: string; from: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  useEffect(() => { if (!roomId) return; initializeLiveStream(); return () => cleanup(); }, [roomId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
  };

  const initializeLiveStream = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please login"); navigate("/stem-reels"); return; }
    setCurrentUserId(user.id);

    const { data: sessionData } = await supabase.from("live_sessions").select("*").eq("room_id", roomId).eq("is_active", true).maybeSingle();
    if (!sessionData) { toast.error("Session not found or ended"); navigate("/stem-reels"); return; }

    setSession(sessionData);
    const hostStatus = sessionData.host_id === user.id;
    setIsHost(hostStatus);
    setIsSpeaker(hostStatus);

    await supabase.from("live_participants").upsert({ session_id: sessionData.id, user_id: user.id, joined_at: new Date().toISOString() }, { onConflict: "session_id,user_id" });

    if (hostStatus) await startLocalStream();

    const { data: speakerData } = await supabase.from("live_speakers").select("*").eq("session_id", sessionData.id).eq("user_id", user.id).maybeSingle();
    if (speakerData?.is_approved) { setIsSpeaker(true); await startLocalStream(); }
    else if (speakerData) setHasRequestedToSpeak(true);

    const channel = supabase.channel(`live-${sessionData.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants", filter: `session_id=eq.${sessionData.id}` }, () => fetchParticipants(sessionData.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_speakers", filter: `session_id=eq.${sessionData.id}` }, () => fetchSpeakers(sessionData.id, user.id))
      .on("broadcast", { event: "message" }, ({ payload }) => setMessages(p => [...p, payload]))
      .on("broadcast", { event: "gift" }, ({ payload }) => { setGifts(p => [...p, payload]); setTimeout(() => setGifts(p => p.filter(g => g !== payload)), 3000); })
      .subscribe();

    fetchParticipants(sessionData.id);
    fetchSpeakers(sessionData.id, user.id);
  };

  const setLocalVideoNode = (node: HTMLVideoElement | null) => {
    (localVideoRef as any).current = node;
    if (node && localStreamRef.current && node.srcObject !== localStreamRef.current) {
      node.srcObject = localStreamRef.current;
      node.play().catch(console.error);
    }
  };

  const startLocalStream = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.error);
      }
    } catch (err: any) {
      console.error("Failed to access camera in LiveStream:", err);
      toast.error("Failed to access camera: " + (err.message || "Permission denied"));
    }
  };

  const fetchParticipants = async (sessionId: string) => {
    const { data } = await supabase.from("live_participants").select("*").eq("session_id", sessionId).is("left_at", null);
    if (data) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      setParticipants(data.map(p => ({ ...p, profiles: profiles?.find(pr => pr.id === p.user_id) || { name: "Unknown" } })));
    }
  };

  const fetchSpeakers = async (sessionId: string, userId: string) => {
    const { data } = await supabase.from("live_speakers").select("*").eq("session_id", sessionId);
    if (data) {
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      setSpeakers(data.map(s => ({ ...s, profiles: profiles?.find(p => p.id === s.user_id) || { name: "Unknown" } })));
      const userSpeaker = data.find(s => s.user_id === userId);
      if (userSpeaker?.is_approved && !isSpeaker) { setIsSpeaker(true); toast.success("You are now a speaker!"); startLocalStream(); }
    }
  };

  const requestToSpeak = async () => {
    if (!session || !currentUserId) return;
    const { error } = await supabase.from("live_speakers").insert({ session_id: session.id, user_id: currentUserId });
    if (error) { toast.error("Failed to request"); return; }
    setHasRequestedToSpeak(true);
    toast.success("Request sent to host");
  };

  const approveSpeaker = async (speakerId: string) => {
    if (!isHost) return;
    await supabase.from("live_speakers").update({ is_approved: true, approved_at: new Date().toISOString() }).eq("id", speakerId);
    toast.success("Speaker approved");
  };

  const removeSpeaker = async (speakerId: string) => {
    if (!isHost) return;
    await supabase.from("live_speakers").delete().eq("id", speakerId);
    toast.success("Speaker removed");
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !session) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const channel = supabase.channel(`live-${session.id}`);
    await channel.send({ type: "broadcast", event: "message", payload: { user: profile?.name || "Unknown", text: newMessage, timestamp: new Date().toISOString() } });
    setNewMessage("");
  };

  const sendGift = async (gift: typeof GIFT_OPTIONS[0]) => {
    if (!session) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const channel = supabase.channel(`live-${session.id}`);
    await channel.send({ type: "broadcast", event: "gift", payload: { type: gift.emoji, from: profile?.name || "Unknown", name: gift.name } });
    toast.success(`Sent ${gift.name}!`);
    setShowGiftPanel(false);
  };

  const shareStream = async () => {
    const shareUrl = `${window.location.origin}/live/${roomId}`;
    if (navigator.share) await navigator.share({ title: session?.title || "Live Stream", url: shareUrl });
    else { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getVideoTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsVideoOff(!t.enabled); }
    }
  };

  const endStream = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !session) return;
    await supabase.from("live_participants").update({ left_at: new Date().toISOString() }).eq("session_id", session.id).eq("user_id", user.id);
    if (isHost) await supabase.from("live_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", session.id);
    cleanup();
    navigate("/stem-reels");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = speakers.filter(s => !s.is_approved);
  const approvedSpeakers = speakers.filter(s => s.is_approved);

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Floating gifts */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {gifts.map((gift, idx) => (
          <div key={idx} className="absolute text-5xl hidden md:block" style={{ left: `${Math.random() * 70 + 15}%`, bottom: "25%", animation: "float 3s ease-out forwards" }}>
            {gift.type}
            <span className="text-xs text-white block text-center mt-1">{gift.from}</span>
          </div>
        ))}
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500 border-0 text-white text-[10px] gap-1 h-6">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
          <Badge className="bg-white/10 border-0 text-white text-[10px] h-6 backdrop-blur-sm">
            <Users className="w-3 h-3 mr-1" />
            {participants.length}
          </Badge>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={shareStream}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8 bg-red-500/90 hover:bg-red-500 text-white text-xs gap-1.5 border-0" onClick={endStream}>
            <X className="w-3.5 h-3.5" />
            {isHost ? "End" : "Leave"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Area */}
        <div className="flex-1 relative">
          {(isHost || isSpeaker) ? (
            <video ref={setLocalVideoNode} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : remoteStream ? (
            <video
              ref={(node) => {
                remoteVideoRef.current = node;
                if (node && remoteStream && node.srcObject !== remoteStream) {
                  node.srcObject = remoteStream;
                  node.play().catch(console.warn);
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary/10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Connecting to live stream...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Waiting for host broadcast</p>
              </div>
            </div>
          )}

          {/* Stream info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <h3 className="text-white font-bold text-sm">{session.title}</h3>
            {session.description && <p className="text-white/60 text-xs mt-0.5">{session.description}</p>}
          </div>

          {/* Speaker controls */}
          {(isHost || isSpeaker) && (
            <div className="absolute bottom-16 right-4 flex gap-2">
              <button onClick={toggleMute} className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${isMuted ? 'bg-red-500/80' : 'bg-white/10'}`}>
                {isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
              </button>
              <button onClick={toggleVideo} className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${isVideoOff ? 'bg-red-500/80' : 'bg-white/10'}`}>
                {isVideoOff ? <VideoOff className="h-4 w-4 text-white" /> : <Video className="h-4 w-4 text-white" />}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`${showChat ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-card border-l border-border/50 flex flex-col`}>
          {/* Speakers */}
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-semibold text-foreground">Speakers</span>
              </div>
              {!isHost && !isSpeaker && !hasRequestedToSpeak && (
                <Button size="sm" variant="ghost" onClick={requestToSpeak} className="h-6 text-[10px] gap-1 px-2">
                  <Hand className="h-3 w-3" /> Raise Hand
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {approvedSpeakers.map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs text-foreground">{s.profiles?.name}</span>
                  </div>
                  {isHost && s.user_id !== currentUserId && (
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeSpeaker(s.id)}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              {isHost && pendingRequests.length > 0 && (
                <div className="pt-1.5 mt-1.5 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Requests:</p>
                  {pendingRequests.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-muted-foreground">{s.profiles?.name}</span>
                      <Button size="sm" variant="ghost" className="h-5 px-1.5" onClick={() => approveSpeaker(s.id)}>
                        <UserPlus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Viewers */}
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Viewers ({participants.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {participants.slice(0, 8).map(p => (
                <Avatar key={p.id} className="w-6 h-6">
                  <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
                    {(p.profiles?.name || "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 8 && <span className="text-[10px] text-muted-foreground self-center ml-1">+{participants.length - 8}</span>}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex-1 overflow-y-auto space-y-2 mb-2">
              {messages.map((msg, idx) => (
                <div key={idx} className="text-xs break-words">
                  <span className="font-semibold text-primary">{msg.user}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="text-foreground/80">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Gift row */}
            <div className="flex gap-1 justify-center mb-2 flex-wrap">
              {GIFT_OPTIONS.slice(0, 4).map(g => (
                <button key={g.emoji} onClick={() => sendGift(g)} className="text-lg px-1.5 py-0.5 rounded hover:bg-secondary transition-colors">{g.emoji}</button>
              ))}
              <Dialog open={showGiftPanel} onOpenChange={setShowGiftPanel}>
                <DialogTrigger asChild>
                  <button className="px-1.5 py-0.5 rounded hover:bg-secondary transition-colors">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-xs">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Send a Gift</DialogTitle>
                    <DialogDescription className="text-xs">Show your appreciation</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {GIFT_OPTIONS.map(g => (
                      <button key={g.emoji} onClick={() => sendGift(g)} className="flex flex-col items-center p-2 rounded-lg hover:bg-secondary transition-colors">
                        <span className="text-2xl">{g.emoji}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex gap-1.5">
              <Input placeholder="Say something..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} className="h-8 text-xs bg-secondary border-border/50" />
              <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={sendMessage}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle chat button (mobile) */}
      <button onClick={() => setShowChat(!showChat)} className="lg:hidden absolute bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
        <MessageCircle className="w-5 h-5 text-white" />
      </button>
    </div>
  );
};

export default LiveStream;
