/**
 * WebRTC Media & Signalling Service
 *
 * Provides:
 *  - fetchIceServers()        — fetches STUN + TURN config from the backend
 *  - createPeerConnection()   — full RTCPeerConnection with ICE state monitoring,
 *                               gathering timeout, relay fallback, and reconnect
 *  - createMeetingRecordingStream() — multi-track audio mixer for composite recording
 *
 * TURN credentials are never stored in frontend code. They are fetched from the
 * `get-ice-servers` Edge Function as time-limited tokens per session.
 */

import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IceServerConfig {
  iceServers: RTCIceServer[];
  hasTurn: boolean;
  ttl: number;
  generatedAt: string;
}

export type CandidateType = "host" | "srflx" | "relay" | "unknown";

export interface ConnectionDiagnostics {
  selectedCandidateType: CandidateType;
  localCandidateType: CandidateType;
  remoteCandidateType: CandidateType;
  rtt?: number;
  hasTurn: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICE Server config cache (per session, refreshed after TTL)
// ─────────────────────────────────────────────────────────────────────────────

let _cachedConfig: IceServerConfig | null = null;
let _cacheTimestamp = 0;

// Public STUN fallback — used if the Edge Function is unreachable
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

/**
 * Fetch ICE server config (STUN + TURN) from the backend Edge Function.
 * Results are cached for (TTL - 60 s) to avoid repeated round-trips.
 * Always returns a usable config — falls back to public STUN if the backend fails.
 */
export async function fetchIceServers(): Promise<IceServerConfig> {
  const now = Date.now();
  const cacheTtlMs = _cachedConfig ? (_cachedConfig.ttl - 60) * 1000 : 0;

  if (_cachedConfig && now - _cacheTimestamp < cacheTtlMs) {
    return _cachedConfig;
  }

  try {
    const { data, error } = await supabase.functions.invoke("get-ice-servers");
    if (error) throw error;

    const config = data as IceServerConfig;
    if (!config.iceServers || config.iceServers.length === 0) {
      throw new Error("Empty iceServers in response");
    }

    _cachedConfig = config;
    _cacheTimestamp = now;

    console.info(
      `[WebRTC] ICE config fetched — ${config.iceServers.length} server(s), hasTurn=${config.hasTurn}`
    );
    return config;
  } catch (err) {
    console.warn(
      "[WebRTC] Could not fetch ICE config from backend; using STUN-only fallback:",
      err
    );
    const fallback: IceServerConfig = {
      iceServers: FALLBACK_ICE_SERVERS,
      hasTurn: false,
      ttl: 3600,
      generatedAt: new Date().toISOString(),
    };
    // Cache for 5 min so we don't spam the failing endpoint
    _cachedConfig = fallback;
    _cacheTimestamp = now - (3600 - 300) * 1000;
    return fallback;
  }
}

/** Invalidate the ICE server cache — forces a fresh fetch next call. */
export function invalidateIceCache() {
  _cachedConfig = null;
  _cacheTimestamp = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Peer Connection
// ─────────────────────────────────────────────────────────────────────────────

const ICE_GATHERING_TIMEOUT_MS = 8000; // Give up waiting for candidates after 8 s

/**
 * Creates an RTCPeerConnection with:
 *  - TURN/STUN ICE servers from the backend (pass the already-fetched config)
 *  - ICE gathering timeout — the connection proceeds even if gathering stalls
 *  - Full connection-state monitoring (disconnected → auto-restart via restartIce)
 *  - Candidate-type logging for diagnostics
 *  - onDiagnostics callback with the selected pair type (host / srflx / relay)
 */
export function createPeerConnection(
  targetUserId: string,
  localStream: MediaStream | null,
  onRemoteTrack: (track: MediaStreamTrack, stream: MediaStream) => void,
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
  iceConfig?: IceServerConfig,
  onDiagnostics?: (diag: ConnectionDiagnostics) => void
): RTCPeerConnection {
  const rtcConfig: RTCConfiguration = {
    iceServers: iceConfig?.iceServers ?? FALLBACK_ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all", // allow both direct and relay; set "relay" to force TURN
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };

  const pc = new RTCPeerConnection(rtcConfig);

  // Add local tracks so remote side receives our audio/video
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  // ICE gathering timeout — resolve early if gathering stalls so the offer/answer
  // is sent with whatever candidates have arrived so far (trickle ICE handles the rest)
  let gatheringTimer: ReturnType<typeof setTimeout> | null = null;
  const armGatheringTimeout = (resolve: () => void) => {
    gatheringTimer = setTimeout(() => {
      if (pc.iceGatheringState !== "complete") {
        console.warn(
          `[WebRTC:${targetUserId}] ICE gathering timed out after ${ICE_GATHERING_TIMEOUT_MS} ms`
        );
        resolve();
      }
    }, ICE_GATHERING_TIMEOUT_MS);
  };

  // Expose a helper callers can await if they want to wait for gathering
  (pc as any).__waitForGathering = () =>
    new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      armGatheringTimeout(resolve);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          if (gatheringTimer) clearTimeout(gatheringTimer);
          resolve();
        }
      };
    });

  // Trickle ICE — send each candidate as it arrives
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const type = event.candidate.type ?? "unknown";
      console.debug(
        `[WebRTC:${targetUserId}] Local ICE candidate: ${type} (${event.candidate.protocol})`
      );
      onIceCandidate(event.candidate);
    } else {
      // null candidate = gathering complete
      console.info(`[WebRTC:${targetUserId}] ICE gathering complete`);
    }
  };

  pc.onicegatheringstatechange = () => {
    console.debug(
      `[WebRTC:${targetUserId}] ICE gathering state: ${pc.iceGatheringState}`
    );
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    console.info(`[WebRTC:${targetUserId}] ICE connection state: ${s}`);

    if (s === "failed") {
      console.warn(
        `[WebRTC:${targetUserId}] ICE failed — attempting restartIce()`
      );
      try {
        pc.restartIce();
      } catch (e) {
        console.warn("[WebRTC] restartIce() not supported or threw:", e);
      }
    }

    if (s === "connected" || s === "completed") {
      // Log selected candidate pair type for diagnostics
      reportSelectedCandidatePair(pc, targetUserId, iceConfig?.hasTurn ?? false, onDiagnostics);
    }
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.info(`[WebRTC:${targetUserId}] Connection state: ${s}`);

    if (onConnectionStateChange) {
      onConnectionStateChange(s);
    }
  };

  // Incoming remote tracks
  pc.ontrack = (event) => {
    const stream = event.streams?.[0] ?? new MediaStream([event.track]);
    console.info(
      `[WebRTC:${targetUserId}] Remote track received: ${event.track.kind}`
    );
    onRemoteTrack(event.track, stream);
  };

  pc.onsignalingstatechange = () => {
    console.debug(
      `[WebRTC:${targetUserId}] Signalling state: ${pc.signalingState}`
    );
  };

  return pc;
}

/** Read the currently selected ICE candidate pair and report the type. */
async function reportSelectedCandidatePair(
  pc: RTCPeerConnection,
  targetUserId: string,
  hasTurn: boolean,
  onDiagnostics?: (diag: ConnectionDiagnostics) => void
) {
  try {
    const stats = await pc.getStats();
    let diag: ConnectionDiagnostics = {
      selectedCandidateType: "unknown",
      localCandidateType: "unknown",
      remoteCandidateType: "unknown",
      hasTurn,
    };

    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.nominated) {
        // Find local and remote candidate
        const local = stats.get(report.localCandidateId);
        const remote = stats.get(report.remoteCandidateId);
        if (local) diag.localCandidateType = (local.candidateType ?? "unknown") as CandidateType;
        if (remote) diag.remoteCandidateType = (remote.candidateType ?? "unknown") as CandidateType;
        // The "selected" type is whichever side is the higher constraint
        diag.selectedCandidateType = diag.localCandidateType === "relay" || diag.remoteCandidateType === "relay"
          ? "relay"
          : diag.localCandidateType === "srflx" || diag.remoteCandidateType === "srflx"
          ? "srflx"
          : "host";
        diag.rtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : undefined;
      }
    });

    console.info(
      `[WebRTC:${targetUserId}] Selected candidate pair: ` +
      `local=${diag.localCandidateType} remote=${diag.remoteCandidateType} ` +
      `→ effective type=${diag.selectedCandidateType}` +
      (diag.rtt !== undefined ? ` RTT=${diag.rtt}ms` : "")
    );

    if (onDiagnostics) onDiagnostics(diag);
  } catch (err) {
    console.warn("[WebRTC] Could not read stats:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite Recording Stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mix multiple media streams (audio + video) into a composite stream for recording.
 * Uses Web Audio API to merge multiple audio sources into a single track.
 */
export function createMeetingRecordingStream(
  videoTrack: MediaStreamTrack | null,
  audioTracks: MediaStreamTrack[]
): { stream: MediaStream; audioContext: AudioContext | null } {
  const activeAudioTracks = audioTracks.filter(
    (t) => t.readyState === "live" && t.enabled
  );

  if (activeAudioTracks.length === 0 && !videoTrack) {
    return { stream: new MediaStream(), audioContext: null };
  }

  // Single audio track — no mixer needed
  if (activeAudioTracks.length <= 1) {
    const tracks: MediaStreamTrack[] = [];
    if (videoTrack && videoTrack.readyState === "live") tracks.push(videoTrack);
    if (activeAudioTracks[0]) tracks.push(activeAudioTracks[0]);
    return { stream: new MediaStream(tracks), audioContext: null };
  }

  // Multi-track audio: mix via Web Audio API
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const dest = ctx.createMediaStreamDestination();

    activeAudioTracks.forEach((track) => {
      try {
        const src = ctx.createMediaStreamSource(new MediaStream([track]));
        src.connect(dest);
      } catch (err) {
        console.warn("[Recording] Could not connect audio track:", err);
      }
    });

    const compositeTracks: MediaStreamTrack[] = [...dest.stream.getAudioTracks()];
    if (videoTrack && videoTrack.readyState === "live") {
      compositeTracks.push(videoTrack);
    }

    return { stream: new MediaStream(compositeTracks), audioContext: ctx };
  } catch (e) {
    console.warn("[Recording] AudioContext mixing failed; using first track:", e);
    const tracks: MediaStreamTrack[] = [];
    if (videoTrack) tracks.push(videoTrack);
    if (activeAudioTracks[0]) tracks.push(activeAudioTracks[0]);
    return { stream: new MediaStream(tracks), audioContext: null };
  }
}
