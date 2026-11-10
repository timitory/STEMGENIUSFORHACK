import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  X, Send, Users, Mic, MicOff, Video, VideoOff, Share2, Gift, Crown,
  UserPlus, Hand, Loader2, MessageCircle, HelpCircle, BarChart3,
  Sparkles, Swords, Shield, Lock, Unlock, Check, ThumbsUp, Trash2,
  Wand2, Image as ImageIcon, Flame, DollarSign, ArrowLeft
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
  is_moderator?: boolean;
  profiles?: { name: string; avatar_url?: string };
}

interface Speaker {
  id: string;
  user_id: string;
  is_approved: boolean;
  profiles?: { name: string };
}

interface QAItem {
  id: string;
  user: string;
  userId: string;
  question: string;
  upvotes: number;
  isAnswered: boolean;
  isAnswering: boolean;
  upvotedBy?: string[];
}

interface PollOption {
  id: number;
  text: string;
  votes: number;
}

interface LivePoll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  isEnded: boolean;
}

const GIFT_OPTIONS = [
  { emoji: "🎁", name: "Gift Box", diamonds: 10 },
  { emoji: "⭐", name: "Star", diamonds: 20 },
  { emoji: "🔥", name: "Fire", diamonds: 30 },
  { emoji: "💎", name: "Diamond", diamonds: 50 },
  { emoji: "👑", name: "Crown", diamonds: 100 },
  { emoji: "🚀", name: "Rocket", diamonds: 200 },
  { emoji: "🎉", name: "Party Popper", diamonds: 150 },
  { emoji: "💝", name: "Golden Heart", diamonds: 300 },
  { emoji: "🏆", name: "STEM Champion", diamonds: 500 },
];

const FILTER_PRESETS = [
  { name: "Normal", filter: "none", icon: "✨" },
  { name: "Beauty Glow", filter: "brightness(1.08) contrast(1.05) saturate(1.15)", icon: "🌸" },
  { name: "Studio Warm", filter: "sepia(0.2) brightness(1.05) saturate(1.2)", icon: "🌅" },
  { name: "Crisp Focus", filter: "contrast(1.25) saturate(1.1)", icon: "🎯" },
  { name: "Vivid STEM", filter: "saturate(1.4) contrast(1.1)", icon: "🔬" },
  { name: "Noir Film", filter: "grayscale(100%) contrast(1.2)", icon: "🎬" },
  { name: "Cyberpunk", filter: "hue-rotate(45deg) saturate(1.3)", icon: "⚡" },
];

const VIRTUAL_BACKDROPS = [
  { name: "None", url: "" },
  { name: "University Library", url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80" },
  { name: "STEM Laboratory", url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80" },
  { name: "Space & Cosmos", url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80" },
  { name: "Modern Classroom", url: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80" },
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
  const [isModerator, setIsModerator] = useState(false);
  const [hasRequestedToSpeak, setHasRequestedToSpeak] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Student");

  // Media states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeFilter, setActiveFilter] = useState("none");
  const [virtualBackdrop, setVirtualBackdrop] = useState("");

  // Gifts & Diamonds
  const [gifts, setGifts] = useState<{ type: string; from: string; name: string; diamonds: number }[]>([]);
  const [diamondBalance, setDiamondBalance] = useState<number>(120);
  const [showGiftPanel, setShowGiftPanel] = useState(false);

  // Q&A Panel State
  const [showQAPanel, setShowQAPanel] = useState(false);
  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: "demo-qa-1",
      user: "Chidi E.",
      userId: "u1",
      question: "Can you explain how conservation of angular momentum applies in projectile motion?",
      upvotes: 6,
      isAnswered: false,
      isAnswering: true,
      upvotedBy: [],
    },
    {
      id: "demo-qa-2",
      user: "Amina K.",
      userId: "u2",
      question: "Which organic chemistry mechanisms come out the most in WAEC / JAMB?",
      upvotes: 4,
      isAnswered: true,
      isAnswering: false,
      upvotedBy: [],
    },
  ]);
  const [newQuestionInput, setNewQuestionInput] = useState("");

  // Polls State
  const [showPollPanel, setShowPollPanel] = useState(false);
  const [activePoll, setActivePoll] = useState<LivePoll | null>({
    id: "poll-initial",
    question: "Which examination are you currently preparing for?",
    options: [
      { id: 1, text: "JAMB UTME 2026", votes: 14 },
      { id: 2, text: "WAEC / WASSCE", votes: 9 },
      { id: 3, text: "NECO / GCE", votes: 4 },
      { id: 4, text: "University 100/200L Exam", votes: 11 },
    ],
    totalVotes: 38,
    isEnded: false,
  });
  const [votedOptionId, setVotedOptionId] = useState<number | null>(null);
  const [createPollQuestion, setCreatePollQuestion] = useState("");
  const [createPollOptions, setCreatePollOptions] = useState(["", ""]);

  // PK Battle State
  const [pkBattle, setPkBattle] = useState<{
    isActive: boolean;
    timeLeft: number;
    hostScore: number;
    guestScore: number;
    guestName: string;
  }>({
    isActive: false,
    timeLeft: 180,
    hostScore: 450,
    guestScore: 410,
    guestName: "Prof. David",
  });

  // Moderation & Settings
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [blockedWords, setBlockedWords] = useState<string[]>(["scam", "spam", "abuse"]);
  const [newBlockedWord, setNewBlockedWord] = useState("");

  // Visual dialogs
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showChat, setShowChat] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;
    initializeLiveStream();
    return () => cleanup();
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // PK Battle countdown timer
  useEffect(() => {
    if (!pkBattle.isActive || pkBattle.timeLeft <= 0) return;
    const timer = setInterval(() => {
      setPkBattle(prev => {
        if (prev.timeLeft <= 1) {
          toast.success("🏆 PK Battle finished!");
          return { ...prev, timeLeft: 0, isActive: false };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pkBattle.isActive, pkBattle.timeLeft]);

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
    if (!user) {
      toast.error("Please login to join live stream");
      navigate("/stem-reels");
      return;
    }
    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.name) setCurrentUserName(profile.name);

    const { data: sessionData } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .maybeSingle();

    if (!sessionData) {
      toast.error("Session not found or already ended");
      navigate("/stem-reels");
      return;
    }

    setSession(sessionData);
    const hostStatus = sessionData.host_id === user.id;
    setIsHost(hostStatus);
    setIsSpeaker(hostStatus);
    if (hostStatus) setIsModerator(true);

    await supabase.from("live_participants").upsert(
      { session_id: sessionData.id, user_id: user.id, joined_at: new Date().toISOString() },
      { onConflict: "session_id,user_id" }
    );

    if (hostStatus) await startLocalStream();

    const { data: speakerData } = await supabase
      .from("live_speakers")
      .select("*")
      .eq("session_id", sessionData.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (speakerData?.is_approved) {
      setIsSpeaker(true);
      await startLocalStream();
    } else if (speakerData) {
      setHasRequestedToSpeak(true);
    }

    // Subscribe to multi-tool realtime broadcasts & persistent Q&A changes
    const channel = supabase.channel(`live-${sessionData.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_participants", filter: `session_id=eq.${sessionData.id}` },
        () => fetchParticipants(sessionData.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_speakers", filter: `session_id=eq.${sessionData.id}` },
        () => fetchSpeakers(sessionData.id, user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_qa_questions", filter: `session_id=eq.${sessionData.id}` },
        () => fetchQAQuestions(sessionData.id)
      )
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((p) => [...p, payload]);
      })
      .on("broadcast", { event: "gift" }, ({ payload }) => {
        setGifts((p) => [...p, payload]);
        setDiamondBalance((prev) => prev + (payload.diamonds || 10));
        setTimeout(() => setGifts((p) => p.filter((g) => g !== payload)), 3500);
      })
      .on("broadcast", { event: "qa_update" }, () => {
        fetchQAQuestions(sessionData.id);
      })
      .on("broadcast", { event: "poll_update" }, ({ payload }) => {
        setActivePoll(payload.poll);
      })
      .on("broadcast", { event: "pk_update" }, ({ payload }) => {
        setPkBattle(payload.pk);
      })
      .on("broadcast", { event: "chat_settings" }, ({ payload }) => {
        if (payload.chatLocked !== undefined) setChatLocked(payload.chatLocked);
        if (payload.blockedWords) setBlockedWords(payload.blockedWords);
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    fetchParticipants(sessionData.id);
    fetchSpeakers(sessionData.id, user.id);
    fetchQAQuestions(sessionData.id);
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
      console.error("Camera access failed:", err);
      toast.error("Failed to access camera: " + (err.message || "Permission denied"));
    }
  };

  const fetchParticipants = async (sessionId: string) => {
    const { data } = await supabase
      .from("live_participants")
      .select("*")
      .eq("session_id", sessionId)
      .is("left_at", null);

    if (data) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);

      setParticipants(
        data.map((p) => ({
          ...p,
          profiles: profiles?.find((pr) => pr.id === p.user_id) || { name: "Student" },
        }))
      );
    }
  };

  const fetchSpeakers = async (sessionId: string, userId: string) => {
    const { data } = await supabase.from("live_speakers").select("*").eq("session_id", sessionId);
    if (data) {
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      setSpeakers(
        data.map((s) => ({
          ...s,
          profiles: profiles?.find((p) => p.id === s.user_id) || { name: "Speaker" },
        }))
      );
      const userSpeaker = data.find((s) => s.user_id === userId);
      if (userSpeaker?.is_approved && !isSpeaker) {
        setIsSpeaker(true);
        toast.success("You are now a live speaker!");
        startLocalStream();
      }
    }
  };

  const requestToSpeak = async () => {
    if (!session || !currentUserId) return;
    const { error } = await supabase
      .from("live_speakers")
      .insert({ session_id: session.id, user_id: currentUserId });

    if (error) {
      toast.error("Failed to send speaker request");
      return;
    }
    setHasRequestedToSpeak(true);
    toast.success("Request sent to host!");
  };

  const approveSpeaker = async (speakerId: string) => {
    if (!isHost && !isModerator) return;
    await supabase
      .from("live_speakers")
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq("id", speakerId);
    toast.success("Guest speaker approved!");
  };

  const removeSpeaker = async (speakerId: string) => {
    if (!isHost && !isModerator) return;
    await supabase.from("live_speakers").delete().eq("id", speakerId);
    toast.success("Speaker removed");
  };

  // Chat message sending with word filtering
  const sendMessage = async () => {
    if (!newMessage.trim() || !session) return;
    if (chatLocked && !isHost && !isModerator) {
      toast.error("Chat is currently locked by the host.");
      return;
    }

    const lower = newMessage.toLowerCase();
    const hasBlocked = blockedWords.some((word) => word && lower.includes(word.toLowerCase()));
    if (hasBlocked) {
      toast.error("Your message contains filtered or restricted words.");
      return;
    }

    const payload = {
      user: currentUserName,
      userId: currentUserId,
      text: newMessage.trim(),
      isHost,
      isModerator,
      timestamp: new Date().toISOString(),
    };

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "message",
        payload,
      });
    }
    setNewMessage("");
  };

  // Gift & Diamonds sending
  const sendGift = async (gift: typeof GIFT_OPTIONS[0]) => {
    if (!session) return;
    const payload = {
      type: gift.emoji,
      name: gift.name,
      diamonds: gift.diamonds,
      from: currentUserName,
    };

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "gift",
        payload,
      });
    }

    // Boost PK Battle score if active
    if (pkBattle.isActive) {
      setPkBattle((prev) => ({
        ...prev,
        hostScore: prev.hostScore + gift.diamonds * 2,
      }));
    }

    toast.success(`Sent ${gift.name} (💎 +${gift.diamonds})!`);
    setShowGiftPanel(false);
  };

  const fetchQAQuestions = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("live_qa_questions")
        .select("*")
        .eq("session_id", sessionId)
        .order("upvotes", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("fetchQAQuestions error:", error.message);
        return;
      }

      if (data) {
        setQaList(
          data.map((q: any) => ({
            id: q.id,
            user: q.user_name || "Student",
            userId: q.user_id,
            question: q.question,
            upvotes: q.upvotes || 0,
            isAnswered: q.is_answered || false,
            isAnswering: q.is_answering || false,
            upvotedBy: [],
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch live Q&A:", err);
    }
  };

  // Q&A submission with persistent database backing
  const handleAskQuestion = async () => {
    if (!newQuestionInput.trim() || !session) return;
    const questionText = newQuestionInput.trim();
    setNewQuestionInput("");

    // Optimistic item
    const tempId = `qa-${Date.now()}`;
    const newQA: QAItem = {
      id: tempId,
      user: currentUserName,
      userId: currentUserId || "",
      question: questionText,
      upvotes: 1,
      isAnswered: false,
      isAnswering: false,
      upvotedBy: [currentUserId || ""],
    };

    setQaList((prev) => [newQA, ...prev]);

    try {
      const { error } = await supabase.from("live_qa_questions").insert({
        session_id: session.id,
        user_id: currentUserId,
        user_name: currentUserName,
        question: questionText,
        upvotes: 1,
        is_answering: false,
        is_answered: false,
      });

      if (error) {
        console.error("Error inserting live QA question:", error);
      } else {
        fetchQAQuestions(session.id);
      }
    } catch (e) {
      console.error("DB insert error:", e);
    }

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "qa_update",
        payload: { refresh: true },
      });
    }
    toast.success("Question submitted to Q&A desk!");
  };

  const handleUpvoteQuestion = async (qaId: string) => {
    const target = qaList.find((item) => item.id === qaId);
    if (!target) return;

    const alreadyVoted = target.upvotedBy?.includes(currentUserId || "");
    const newCount = alreadyVoted ? Math.max(0, target.upvotes - 1) : target.upvotes + 1;

    const updated = qaList.map((item) => {
      if (item.id === qaId) {
        return {
          ...item,
          upvotes: newCount,
          upvotedBy: alreadyVoted
            ? (item.upvotedBy || []).filter((id) => id !== currentUserId)
            : [...(item.upvotedBy || []), currentUserId || ""],
        };
      }
      return item;
    });
    setQaList(updated);

    try {
      await supabase
        .from("live_qa_questions")
        .update({ upvotes: newCount })
        .eq("id", qaId);
    } catch (e) {
      console.error("Failed to update upvote in DB:", e);
    }

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "qa_update",
        payload: { refresh: true },
      });
    }
  };

  const toggleAnsweringQA = async (qaId: string, isAnswering: boolean, isAnswered: boolean) => {
    if (!isHost && !isSpeaker && !isModerator) return;
    const updated = qaList.map((item) =>
      item.id === qaId ? { ...item, isAnswering, isAnswered } : item
    );
    setQaList(updated);

    try {
      await supabase
        .from("live_qa_questions")
        .update({ is_answering: isAnswering, is_answered: isAnswered })
        .eq("id", qaId);
    } catch (e) {
      console.error("Failed to update QA answering state:", e);
    }

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "qa_update",
        payload: { refresh: true },
      });
    }
  };

  // Poll voting
  const handleVotePoll = async (optionId: number) => {
    if (!activePoll || activePoll.isEnded || votedOptionId !== null) return;
    setVotedOptionId(optionId);

    const updatedPoll: LivePoll = {
      ...activePoll,
      totalVotes: activePoll.totalVotes + 1,
      options: activePoll.options.map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      ),
    };
    setActivePoll(updatedPoll);

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "poll_update",
        payload: { poll: updatedPoll },
      });
    }
    toast.success("Vote recorded!");
  };

  // Create new poll
  const handleCreatePoll = async () => {
    if (!createPollQuestion.trim()) {
      toast.error("Please enter a poll question");
      return;
    }
    const validOpts = createPollOptions.filter((o) => o.trim());
    if (validOpts.length < 2) {
      toast.error("Please provide at least 2 options");
      return;
    }

    const newPoll: LivePoll = {
      id: `poll-${Date.now()}`,
      question: createPollQuestion.trim(),
      options: validOpts.map((text, i) => ({ id: i + 1, text: text.trim(), votes: 0 })),
      totalVotes: 0,
      isEnded: false,
    };

    setActivePoll(newPoll);
    setVotedOptionId(null);
    setCreatePollQuestion("");
    setCreatePollOptions(["", ""]);
    setShowPollPanel(false);

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "poll_update",
        payload: { poll: newPoll },
      });
    }
    toast.success("Live poll launched to audience!");
  };

  // Toggle PK Battle
  const handleTogglePKBattle = async () => {
    if (!isHost) return;
    const nextState = {
      isActive: !pkBattle.isActive,
      timeLeft: 180,
      hostScore: 100,
      guestScore: 100,
      guestName: speakers.find((s) => s.is_approved && s.user_id !== currentUserId)?.profiles?.name || "Guest Contender",
    };
    setPkBattle(nextState);

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "pk_update",
        payload: { pk: nextState },
      });
    }
    toast.success(nextState.isActive ? "⚔️ 3-Minute PK Battle started!" : "PK Battle stopped");
  };

  // Chat settings & moderation
  const toggleChatLock = async () => {
    if (!isHost && !isModerator) return;
    const nextLocked = !chatLocked;
    setChatLocked(nextLocked);

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "chat_settings",
        payload: { chatLocked: nextLocked, blockedWords },
      });
    }
    toast.success(nextLocked ? "Chat locked by host" : "Chat unlocked");
  };

  const handleAddBlockedWord = () => {
    if (!newBlockedWord.trim()) return;
    const word = newBlockedWord.trim().toLowerCase();
    if (!blockedWords.includes(word)) {
      const updated = [...blockedWords, word];
      setBlockedWords(updated);
      setNewBlockedWord("");
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "chat_settings",
          payload: { chatLocked, blockedWords: updated },
        });
      }
      toast.success(`Added "${word}" to blocked words`);
    }
  };

  const handleRemoveBlockedWord = (word: string) => {
    const updated = blockedWords.filter((w) => w !== word);
    setBlockedWords(updated);
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "chat_settings",
        payload: { chatLocked, blockedWords: updated },
      });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        setIsMuted(!t.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getVideoTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        setIsVideoOff(!t.enabled);
      }
    }
  };

  const shareStream = async () => {
    const shareUrl = `${window.location.origin}/live/${roomId}`;
    if (navigator.share) {
      await navigator.share({ title: session?.title || "STEM Live Stream", url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Live stream link copied to clipboard!");
    }
  };

  const endStream = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !session) return;
    await supabase
      .from("live_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("session_id", session.id)
      .eq("user_id", user.id);

    if (isHost) {
      await supabase
        .from("live_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", session.id);
    }
    cleanup();
    navigate("/dashboard");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = speakers.filter((s) => !s.is_approved);
  const approvedSpeakers = speakers.filter((s) => s.is_approved);
  const isMultiGuest = approvedSpeakers.length > 0;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden relative select-none">
      {/* Floating Animated Gifts Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {gifts.map((g, idx) => (
          <div
            key={idx}
            className="absolute flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500"
            style={{
              left: `${20 + (idx % 4) * 20}%`,
              bottom: "35%",
              animation: "bounce 2.5s ease-out forwards",
            }}
          >
            <span className="text-6xl drop-shadow-lg">{g.type}</span>
            <div className="px-3 py-1 mt-1 rounded-full bg-black/80 border border-primary/40 backdrop-blur-md shadow-xl text-center">
              <span className="text-xs font-bold text-white block">{g.name}</span>
              <span className="text-[10px] text-amber-300 font-semibold block">
                From {g.from} • 💎 +{g.diamonds}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-2 sm:px-3.5 py-2 sm:py-2.5 bg-gradient-to-b from-black/95 via-black/60 to-transparent absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 rounded-full shrink-0"
            onClick={() => navigate("/dashboard")}
            title="Exit to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <Badge className="bg-red-600 border-0 text-white text-[10px] font-bold tracking-wider gap-1 h-6 px-1.5 sm:px-2 shadow-lg shadow-red-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>

          {/* Diamonds & Revenue Tracker */}
          <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/60 border border-amber-500/40 backdrop-blur-md text-amber-300 text-xs font-semibold shadow-sm shrink-0">
            <span className="text-xs sm:text-sm">💎</span>
            <span>{diamondBalance.toLocaleString()}</span>
            <span className="text-[10px] text-white/50 hidden md:inline">
              (~${(diamondBalance * 0.01).toFixed(2)})
            </span>
          </div>

          <Badge className="bg-white/10 border-0 text-white text-[10px] h-6 backdrop-blur-md hidden sm:inline-flex shrink-0">
            <Users className="w-3 h-3 mr-1" />
            {participants.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1">
          {/* Active PK Battle Indicator */}
          {pkBattle.isActive && (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gradient-to-r from-red-600 to-indigo-600 text-white text-[10px] sm:text-xs font-extrabold animate-pulse shadow-md">
              <Swords className="w-3 h-3" />
              <span className="hidden sm:inline">PK: </span>
              <span>
                {Math.floor(pkBattle.timeLeft / 60)}:
                {(pkBattle.timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 rounded-full shrink-0"
            onClick={shareStream}
            title="Share Stream"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Prominent End Stream / Exit button - Always visible and clickable */}
          <Button
            size="sm"
            className="h-8 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold gap-1 px-2.5 sm:px-3 rounded-full border-0 shadow-lg shadow-red-600/40 shrink-0"
            onClick={endStream}
          >
            <X className="w-3.5 h-3.5" />
            <span>{isHost ? "End Stream" : "Exit"}</span>
          </Button>
        </div>
      </div>

      {/* Main Stream Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <div className="flex-1 relative bg-neutral-950 flex flex-col justify-center overflow-hidden">
          {/* Virtual Backdrop background if selected */}
          {virtualBackdrop && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-70 z-0 pointer-events-none"
              style={{ backgroundImage: `url(${virtualBackdrop})` }}
            />
          )}

          {/* PK Battle Tug-of-War Bar */}
          {pkBattle.isActive && (
            <div className="absolute top-14 left-4 right-4 z-30 flex flex-col gap-1">
              <div className="flex justify-between text-xs font-black text-white px-1">
                <span className="flex items-center gap-1 text-red-400">
                  <Flame className="w-3.5 h-3.5 fill-red-500" /> Host ({pkBattle.hostScore})
                </span>
                <span className="text-blue-400">
                  {pkBattle.guestName} ({pkBattle.guestScore})
                </span>
              </div>
              <div className="h-2.5 w-full bg-blue-600 rounded-full overflow-hidden flex shadow-lg">
                <div
                  className="bg-red-600 h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(10, Math.min(90, (pkBattle.hostScore / (pkBattle.hostScore + pkBattle.guestScore || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Active Poll Floating Overlay */}
          {activePoll && !activePoll.isEnded && (
            <div className="absolute top-24 left-4 z-30 max-w-xs w-72 p-3 rounded-2xl bg-black/85 border border-primary/40 backdrop-blur-md shadow-2xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Live STEM Poll
                </span>
                <span className="text-[10px] text-white/60 font-mono">
                  {activePoll.totalVotes} votes
                </span>
              </div>
              <p className="text-xs font-semibold text-white leading-tight">
                {activePoll.question}
              </p>
              <div className="space-y-1.5 pt-1">
                {activePoll.options.map((opt) => {
                  const pct = activePoll.totalVotes > 0 ? Math.round((opt.votes / activePoll.totalVotes) * 100) : 0;
                  const isVoted = votedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVotePoll(opt.id)}
                      disabled={votedOptionId !== null}
                      className={`relative w-full text-left p-1.5 rounded-lg border text-xs overflow-hidden transition-all ${
                        isVoted
                          ? "border-primary bg-primary/20 text-white font-bold"
                          : "border-white/10 hover:border-white/30 text-white/90 bg-white/5"
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/25 -z-10 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="flex justify-between items-center px-1">
                        <span className="truncate pr-2">{opt.text}</span>
                        <span className="text-[10px] font-mono shrink-0">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video Feeds (Multi-Guest & Solo Modes) */}
          <div className="w-full h-full relative z-10 flex">
            {isMultiGuest ? (
              // Multi-Guest Split Grid (PK Battle or Group live)
              <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-1 p-1">
                {/* Host Feed */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-900 border border-red-500/40">
                  <video
                    ref={setLocalVideoNode}
                    autoPlay
                    playsInline
                    muted
                    style={{ filter: activeFilter }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> {currentUserName} (Host)
                  </div>
                </div>

                {/* Guest Feed */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-900 border border-blue-500/40 flex items-center justify-center">
                  {remoteStream ? (
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
                    <div className="text-center p-4">
                      <Avatar className="w-16 h-16 mx-auto mb-2 ring-2 ring-primary">
                        <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                          {(approvedSpeakers[0]?.profiles?.name || "G").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-semibold text-white">
                        {approvedSpeakers[0]?.profiles?.name || "Guest Speaker"}
                      </p>
                      <Badge variant="outline" className="text-[9px] text-primary border-primary/40 mt-1">
                        Co-Host
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white font-bold flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-400" /> {approvedSpeakers[0]?.profiles?.name || "Guest"}
                  </div>
                </div>
              </div>
            ) : (
              // Solo Host View
              <div className="w-full h-full relative">
                {isHost || isSpeaker ? (
                  <video
                    ref={setLocalVideoNode}
                    autoPlay
                    playsInline
                    muted
                    style={{ filter: activeFilter }}
                    className="w-full h-full object-cover"
                  />
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
                    <div className="text-center p-6 max-w-sm">
                      <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mx-auto mb-3">
                        <Loader2 className="w-7 h-7 animate-spin" />
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">{session.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Connecting to live stream... Waiting for host transmission.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stream Title Overlay */}
          <div className="absolute bottom-16 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-20">
            <h3 className="text-white font-extrabold text-xs sm:text-base drop-shadow-md truncate">
              {session.title}
            </h3>
            {session.description && (
              <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 line-clamp-1 sm:line-clamp-2 max-w-md">
                {session.description}
              </p>
            )}
          </div>

          {/* Mobile Floating Comments (TikTok/IG Live Style - shown when chat drawer is closed) */}
          {!showChat && (
            <div className="lg:hidden absolute bottom-16 left-3 right-16 z-25 pointer-events-none flex flex-col justify-end space-y-1.5 max-h-44 overflow-hidden">
              {messages.slice(-4).map((msg, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center max-w-[90%] self-start px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] text-white shadow-md animate-in fade-in slide-in-from-bottom-2"
                >
                  <span
                    className={`font-bold mr-1.5 shrink-0 ${
                      msg.isHost
                        ? "text-red-400"
                        : msg.isModerator
                        ? "text-amber-400"
                        : "text-sky-300"
                    }`}
                  >
                    {msg.user}:
                  </span>
                  <span className="truncate text-white/90">{msg.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Interactive Toolbar */}
          <div className="absolute bottom-2 left-2 right-2 z-30 flex items-center justify-between gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-md overflow-x-auto scrollbar-none">
            {/* Host/Speaker mic & cam */}
            {(isHost || isSpeaker) && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleMute}
                  className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${isMuted ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleVideo}
                  className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${isVideoOff ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                  title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                >
                  {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {/* Interactive feature buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {/* Q&A Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQAPanel(true)}
                className="h-8 text-xs font-semibold gap-1 text-white hover:bg-white/10 rounded-xl px-2 sm:px-2.5 shrink-0"
                title="Q&A Panel"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Q&A</span>
                {qaList.filter((q) => !q.isAnswered).length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-sky-500 text-[9px] font-bold text-white flex items-center justify-center shrink-0">
                    {qaList.filter((q) => !q.isAnswered).length}
                  </span>
                )}
              </Button>

              {/* Poll Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPollPanel(true)}
                className="h-8 text-xs font-semibold gap-1 text-white hover:bg-white/10 rounded-xl px-2 sm:px-2.5 shrink-0"
                title="Polls"
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Poll</span>
              </Button>

              {/* Gifts Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowGiftPanel(true)}
                className="h-8 text-xs font-semibold gap-1 text-white hover:bg-white/10 rounded-xl px-2 sm:px-2.5 shrink-0"
                title="Send Gift & Diamonds"
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>Gifts</span>
              </Button>

              {/* Filter & Effects Button (Host & Speaker) */}
              {(isHost || isSpeaker) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFilterPanel(true)}
                  className="h-8 text-xs font-semibold gap-1 text-white hover:bg-white/10 rounded-xl px-2 sm:px-2.5 shrink-0"
                  title="Filters & Effects"
                >
                  <Wand2 className="w-3.5 h-3.5 text-pink-400" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
              )}

              {/* PK Battle Toggle (Host) */}
              {isHost && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleTogglePKBattle}
                  className={`h-8 text-xs font-semibold gap-1 rounded-xl px-2 sm:px-2.5 shrink-0 ${
                    pkBattle.isActive
                      ? "bg-red-600 text-white animate-pulse"
                      : "text-white hover:bg-white/10"
                  }`}
                  title="PK Battle / Multi-Guest"
                >
                  <Swords className="w-3.5 h-3.5 text-orange-400" />
                  <span>{pkBattle.isActive ? "End PK" : "PK"}</span>
                </Button>
              )}

              {/* Chat Moderation & Settings (Host/Moderator) */}
              {(isHost || isModerator) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSettingsPanel(true)}
                  className="h-8 text-xs font-semibold gap-1 text-white hover:bg-white/10 rounded-xl px-2 sm:px-2.5 shrink-0"
                  title="Chat Moderation & Settings"
                >
                  <Shield className="w-3.5 h-3.5 text-primary" />
                </Button>
              )}

              {/* Toggle Chat Drawer (Mobile) */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowChat(!showChat)}
                className="h-8 w-8 text-white hover:bg-white/10 rounded-xl shrink-0 lg:hidden"
                title="Toggle Live Chat"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── RIGHT LIVE CHAT & PARTICIPANTS SIDEBAR ───────────────────────── */}
        <div
          className={`
            fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] bg-card/95 border-l border-border/60 flex flex-col backdrop-blur-xl transition-transform duration-300
            lg:static lg:translate-x-0
            ${showChat ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Top Speakers Header */}
          <div className="p-3 border-b border-border/50 bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-foreground">Live Panel & Guests</span>
              </div>
              <div className="flex items-center gap-1">
                {!isHost && !isSpeaker && !hasRequestedToSpeak && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={requestToSpeak}
                    className="h-6 text-[10px] gap-1 px-2 border-primary/40 text-primary"
                  >
                    <Hand className="h-3 w-3" /> Join Stage
                  </Button>
                )}
                {/* Mobile close button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground lg:hidden rounded-full"
                  onClick={() => setShowChat(false)}
                  title="Close chat drawer"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              {approvedSpeakers.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-0.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-foreground font-medium">{s.profiles?.name}</span>
                  </div>
                  {isHost && s.user_id !== currentUserId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 hover:text-destructive"
                      onClick={() => removeSpeaker(s.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              {isHost && pendingRequests.length > 0 && (
                <div className="pt-2 mt-1 border-t border-border/40">
                  <span className="text-[10px] font-bold text-primary">Pending Guest Requests:</span>
                  {pendingRequests.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-muted-foreground truncate">{s.profiles?.name}</span>
                      <Button
                        size="sm"
                        className="h-5 text-[10px] px-2 bg-primary hover:bg-primary/90"
                        onClick={() => approveSpeaker(s.id)}
                      >
                        <UserPlus className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages Scroll */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {chatLocked && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-500 flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Comments are locked by host
              </div>
            )}

            {messages.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                <p>Welcome to STEM Genius Live!</p>
                <p className="text-[10px] mt-1">Send questions, participate in polls, and cheer on the tutor.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="text-xs leading-relaxed break-words">
                  <span
                    className={`font-bold mr-1 ${
                      msg.isHost
                        ? "text-red-500"
                        : msg.isModerator
                        ? "text-amber-500"
                        : "text-primary"
                    }`}
                  >
                    {msg.user}
                    {msg.isHost && " 👑"}
                    {msg.isModerator && " 🛡️"}:
                  </span>
                  <span className="text-foreground/90">{msg.text}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Gift Buttons */}
          <div className="px-3 pt-2 pb-1 border-t border-border/40 flex items-center justify-between gap-1 bg-secondary/20">
            {GIFT_OPTIONS.slice(0, 5).map((g) => (
              <button
                key={g.emoji}
                onClick={() => sendGift(g)}
                className="text-lg p-1 rounded-lg hover:bg-secondary hover:scale-110 active:scale-95 transition-transform"
                title={`${g.name} (💎 ${g.diamonds})`}
              >
                {g.emoji}
              </button>
            ))}
            <button
              onClick={() => setShowGiftPanel(true)}
              className="text-xs font-semibold text-amber-400 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20"
            >
              More 🎁
            </button>
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-border/40 bg-card">
            <div className="flex gap-1.5">
              <Input
                placeholder={chatLocked && !isHost ? "Chat locked..." : "Say something in STEM Live..."}
                disabled={chatLocked && !isHost && !isModerator}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="h-8 text-xs bg-secondary/50 border-border/50"
              />
              <Button
                size="icon"
                disabled={chatLocked && !isHost && !isModerator}
                className="h-8 w-8 shrink-0 bg-primary hover:bg-primary/90"
                onClick={sendMessage}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SHEET: Q&A ORGANIZED PANEL ───────────────────────────────────── */}
      <Sheet open={showQAPanel} onOpenChange={setShowQAPanel}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card border-border flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-sm font-bold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <span>Q&A Desk</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {qaList.length} questions
              </Badge>
            </SheetTitle>
          </SheetHeader>

          {/* Ask question input */}
          <div className="pt-3 pb-2 space-y-2">
            <Input
              placeholder="Ask the host a concise STEM question..."
              value={newQuestionInput}
              onChange={(e) => setNewQuestionInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              className="text-xs h-9 bg-secondary"
            />
            <Button
              onClick={handleAskQuestion}
              disabled={!newQuestionInput.trim()}
              size="sm"
              className="w-full h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
            >
              Submit Question
            </Button>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pt-2">
            {qaList.map((qa) => (
              <div
                key={qa.id}
                className={`p-3 rounded-xl border transition-all ${
                  qa.isAnswering
                    ? "border-sky-500 bg-sky-500/10 shadow-sm"
                    : qa.isAnswered
                    ? "border-border/40 opacity-70 bg-secondary/20"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-primary">{qa.user}</span>
                  {qa.isAnswering && (
                    <Badge className="bg-sky-500 text-white text-[9px] animate-pulse">
                      Answering Live
                    </Badge>
                  )}
                  {qa.isAnswered && (
                    <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/40">
                      <Check className="w-2.5 h-2.5 mr-1" /> Answered
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground leading-relaxed">{qa.question}</p>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40 text-[11px]">
                  <button
                    onClick={() => handleUpvoteQuestion(qa.id)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-sky-400 transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{qa.upvotes} upvotes</span>
                  </button>

                  {(isHost || isSpeaker || isModerator) && (
                    <div className="flex gap-1.5">
                      {!qa.isAnswering && !qa.isAnswered && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-sky-400 hover:bg-sky-500/10 px-2"
                          onClick={() => toggleAnsweringQA(qa.id, true, false)}
                        >
                          Answer Now
                        </Button>
                      )}
                      {!qa.isAnswered && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-emerald-400 hover:bg-emerald-500/10 px-2"
                          onClick={() => toggleAnsweringQA(qa.id, false, true)}
                        >
                          Mark Done
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── DIALOG: POLLS MANAGER & CREATION ───────────────────────────────── */}
      <Dialog open={showPollPanel} onOpenChange={setShowPollPanel}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Interactive Polls</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Engage audience understanding with real-time multiple choice questions.
            </DialogDescription>
          </DialogHeader>

          {isHost ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground">Poll Question:</label>
                <Input
                  placeholder="e.g. Which topic should we solve next?"
                  value={createPollQuestion}
                  onChange={(e) => setCreatePollQuestion(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Options:</label>
                {createPollOptions.map((opt, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const updated = [...createPollOptions];
                      updated[idx] = e.target.value;
                      setCreatePollOptions(updated);
                    }}
                    className="text-xs h-8"
                  />
                ))}
                {createPollOptions.length < 4 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 w-full border-dashed"
                    onClick={() => setCreatePollOptions([...createPollOptions, ""])}
                  >
                    + Add Option
                  </Button>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreatePoll}
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Launch Poll to Stream
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {activePoll ? (
                <div>
                  <p className="font-semibold text-foreground mb-2">{activePoll.question}</p>
                  <p>Cast your vote directly on the stream video screen overlay!</p>
                </div>
              ) : (
                <p>No active poll at the moment. The host will launch one shortly!</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: GIFTS & DIAMONDS SHOP ─────────────────────────────────── */}
      <Dialog open={showGiftPanel} onOpenChange={setShowGiftPanel}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>Send Gifts & Support</span>
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">
                💎 Balance: {diamondBalance}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cheer your educator and boost live interaction.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2.5 py-2">
            {GIFT_OPTIONS.map((g) => (
              <button
                key={g.emoji}
                onClick={() => sendGift(g)}
                className="flex flex-col items-center p-3 rounded-2xl border border-border/60 hover:border-amber-400/60 bg-secondary/30 hover:bg-amber-500/10 transition-all group"
              >
                <span className="text-3xl group-hover:scale-125 transition-transform">{g.emoji}</span>
                <span className="text-xs font-bold text-foreground mt-1.5">{g.name}</span>
                <span className="text-[10px] font-mono font-bold text-amber-400 mt-0.5">
                  💎 {g.diamonds}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: FILTERS & EFFECTS ─────────────────────────────────────── */}
      <Dialog open={showFilterPanel} onOpenChange={setShowFilterPanel}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-pink-400" />
              <span>Face Filters & Virtual Studio</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adjust camera styling, enhancement, or set a virtual backdrop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-foreground mb-2 block">
                Visual Filter Effects:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FILTER_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setActiveFilter(p.filter);
                      toast.success(`Filter set to ${p.name}`);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center gap-2 ${
                      activeFilter === p.filter
                        ? "border-pink-500 bg-pink-500/15 font-bold text-pink-300"
                        : "border-border/60 hover:border-pink-500/40 bg-secondary/40 text-foreground"
                    }`}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-2 block">
                Virtual Backdrop (Green Screen):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VIRTUAL_BACKDROPS.map((bd) => (
                  <button
                    key={bd.name}
                    onClick={() => {
                      setVirtualBackdrop(bd.url);
                      toast.success(`Backdrop set to ${bd.name}`);
                    }}
                    className={`p-2 rounded-xl border text-xs text-left truncate transition-all ${
                      virtualBackdrop === bd.url
                        ? "border-primary bg-primary/20 font-bold text-primary"
                        : "border-border/60 bg-secondary/40 text-foreground"
                    }`}
                  >
                    {bd.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CHAT MODERATION & SETTINGS ────────────────────────────── */}
      <Dialog open={showSettingsPanel} onOpenChange={setShowSettingsPanel}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Chat Moderation & Room Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Maintain a clean, respectful academic environment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Lock comments switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
              <div>
                <p className="text-xs font-semibold text-foreground">Lock Viewer Comments</p>
                <p className="text-[10px] text-muted-foreground">
                  Prevent audience from sending chat messages during lectures.
                </p>
              </div>
              <Button
                size="sm"
                variant={chatLocked ? "destructive" : "outline"}
                onClick={toggleChatLock}
                className="text-xs h-7"
              >
                {chatLocked ? <Lock className="w-3.5 h-3.5 mr-1" /> : <Unlock className="w-3.5 h-3.5 mr-1" />}
                {chatLocked ? "Locked" : "Unlocked"}
              </Button>
            </div>

            {/* Blocked words */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Banned / Blocked Words:
              </label>
              <div className="flex gap-1.5 mb-2">
                <Input
                  placeholder="Enter word to filter..."
                  value={newBlockedWord}
                  onChange={(e) => setNewBlockedWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBlockedWord()}
                  className="text-xs h-8"
                />
                <Button size="sm" onClick={handleAddBlockedWord} className="text-xs h-8">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {blockedWords.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="text-[10px] gap-1 px-2 py-0.5"
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveBlockedWord(word)}
                      className="hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiveStream;
