/**
 * Client-Side Video Compression and Trimming Utility for STEM Reels
 * Handles large video uploads (up to 150MB) and automatically downscales/compresses
 * high-bitrate or high-resolution videos into lightweight, high-quality 720p/1080p
 * files to guarantee fast and successful cloud uploads.
 */

export interface CompressionProgress {
  stage: "analyzing" | "compressing" | "finalizing" | "ready";
  progress: number; // 0 - 100
  message: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  originalSize: number;
}

export const MAX_REEL_FILE_SIZE = 150 * 1024 * 1024; // 150 MB
export const COMPRESSION_THRESHOLD_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_REEL_DURATION = 90; // 90 seconds max for STEM reels

/**
 * Extract basic video metadata (duration, width, height)
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 720,
        height: video.videoHeight || 1280,
        originalSize: file.size,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read video metadata. Please ensure the file is a valid video."));
    };
  });
}

/**
 * Optimizes, compresses, and optionally trims a video client-side.
 * Uses Canvas + MediaRecorder API to produce high quality, efficient video.
 */
export async function compressAndOptimizeVideo(
  file: File,
  options: {
    maxDurationSeconds?: number;
    targetWidth?: number;
    targetHeight?: number;
    videoBitrate?: number; // default ~2 Mbps
    onProgress?: (progress: CompressionProgress) => void;
  } = {}
): Promise<{ compressedFile: File; savedPercent: number; isCompressed: boolean }> {
  const {
    maxDurationSeconds = MAX_REEL_DURATION,
    targetWidth = 720,
    targetHeight = 1280,
    videoBitrate = 2_200_000, // 2.2 Mbps (great balance of quality and size)
    onProgress = () => {},
  } = options;

  if (file.size > MAX_REEL_FILE_SIZE) {
    throw new Error("File exceeds 150MB limit. Please select a video up to 150MB.");
  }

  onProgress({
    stage: "analyzing",
    progress: 5,
    message: "Analyzing video dimensions and duration...",
  });

  const metadata = await getVideoMetadata(file);

  // If the file is already small (< 20MB) and within reasonable duration, no need to transcode
  const needsTrimming = metadata.duration > maxDurationSeconds;
  const needsCompression = file.size > COMPRESSION_THRESHOLD_SIZE || needsTrimming;

  if (!needsCompression) {
    onProgress({
      stage: "ready",
      progress: 100,
      message: "Video is optimized and ready for upload.",
    });
    return {
      compressedFile: file,
      savedPercent: 0,
      isCompressed: false,
    };
  }

  // Check MediaRecorder support
  if (typeof window === "undefined" || !window.MediaRecorder) {
    // If MediaRecorder is not available, pass original file
    return {
      compressedFile: file,
      savedPercent: 0,
      isCompressed: false,
    };
  }

  // Determine target aspect ratio & resolution
  const isPortrait = metadata.height >= metadata.width;
  let outWidth = isPortrait ? targetWidth : targetHeight;
  let outHeight = isPortrait ? targetHeight : targetWidth;

  // Preserve aspect ratio
  const originalAspect = metadata.width / metadata.height;
  if (isPortrait) {
    outWidth = Math.min(metadata.width, targetWidth);
    outHeight = Math.round(outWidth / originalAspect);
    // Make even numbers for video codecs
    if (outHeight % 2 !== 0) outHeight += 1;
    if (outWidth % 2 !== 0) outWidth += 1;
  } else {
    outHeight = Math.min(metadata.height, 720);
    outWidth = Math.round(outHeight * originalAspect);
    if (outHeight % 2 !== 0) outHeight += 1;
    if (outWidth % 2 !== 0) outWidth += 1;
  }

  const effectiveDuration = Math.min(metadata.duration, maxDurationSeconds);

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = false; // Capture audio
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      URL.revokeObjectURL(video.src);
      resolve({ compressedFile: file, savedPercent: 0, isCompressed: false });
      return;
    }

    video.onloadeddata = async () => {
      try {
        const stream = canvas.captureStream(30);

        // Capture audio track from video if available
        let audioTrack: MediaStreamTrack | null = null;
        try {
          // Web Audio API or captureStream from HTMLMediaElement
          const anyVideo = video as any;
          if (typeof anyVideo.captureStream === "function") {
            const videoStream = anyVideo.captureStream();
            const tracks = videoStream.getAudioTracks();
            if (tracks.length > 0) {
              audioTrack = tracks[0];
              stream.addTrack(audioTrack);
            }
          } else if (typeof anyVideo.mozCaptureStream === "function") {
            const videoStream = anyVideo.mozCaptureStream();
            const tracks = videoStream.getAudioTracks();
            if (tracks.length > 0) {
              audioTrack = tracks[0];
              stream.addTrack(audioTrack);
            }
          }
        } catch {
          // Ignore audio capture fallback if restricted
        }

        // Determine mime type supported by browser
        let mimeType = "video/webm;codecs=vp8,opus";
        if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2")) {
          mimeType = "video/mp4;codecs=avc1,mp4a.40.2";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          mimeType = "video/webm;codecs=vp9,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          mimeType = "video/webm";
        }

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: videoBitrate,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          const extension = mimeType.includes("mp4") ? "mp4" : "webm";
          const compressedBlob = new Blob(chunks, { type: mimeType });
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + `_optimized.${extension}`;
          const compressedFile = new File([compressedBlob], newFileName, {
            type: mimeType,
            lastModified: Date.now(),
          });

          const savedBytes = Math.max(0, file.size - compressedFile.size);
          const savedPercent = Math.round((savedBytes / file.size) * 100);

          onProgress({
            stage: "ready",
            progress: 100,
            message: `Optimized! Reduced size by ${savedPercent}% (${(compressedFile.size / (1024 * 1024)).toFixed(1)} MB).`,
          });

          resolve({
            compressedFile: compressedFile.size < file.size ? compressedFile : file,
            savedPercent,
            isCompressed: true,
          });
        };

        recorder.onerror = (err) => {
          console.warn("MediaRecorder compression failed, using original file:", err);
          URL.revokeObjectURL(video.src);
          resolve({ compressedFile: file, savedPercent: 0, isCompressed: false });
        };

        recorder.start(100);

        let animationFrameId: number;
        const renderLoop = () => {
          if (video.paused || video.ended || video.currentTime >= effectiveDuration) {
            cancelAnimationFrame(animationFrameId);
            if (recorder.state === "recording") {
              recorder.stop();
            }
            return;
          }

          ctx.drawImage(video, 0, 0, outWidth, outHeight);

          const currentSec = video.currentTime;
          const pct = Math.min(95, Math.round((currentSec / effectiveDuration) * 90) + 5);
          onProgress({
            stage: "compressing",
            progress: pct,
            message: `Optimizing video (${pct}%)... ${needsTrimming ? "Trimming to " + maxDurationSeconds + "s" : ""}`,
          });

          animationFrameId = requestAnimationFrame(renderLoop);
        };

        video.currentTime = 0;
        await video.play();
        renderLoop();

        // Safety timeout to ensure recorder doesn't run indefinitely
        const safetyTimeoutMs = (effectiveDuration + 3) * 1000;
        setTimeout(() => {
          if (recorder.state === "recording") {
            try {
              video.pause();
              recorder.stop();
            } catch {}
          }
        }, safetyTimeoutMs);
      } catch (err) {
        console.warn("Video processing error, falling back to original:", err);
        URL.revokeObjectURL(video.src);
        resolve({ compressedFile: file, savedPercent: 0, isCompressed: false });
      }
    };

    video.onerror = (err) => {
      console.warn("Video load error during compression:", err);
      URL.revokeObjectURL(video.src);
      resolve({ compressedFile: file, savedPercent: 0, isCompressed: false });
    };
  });
}

