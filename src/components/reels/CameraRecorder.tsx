import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Square, Video, Loader2, AlertCircle } from "lucide-react";
import { VideoEditor } from "./VideoEditor";

interface CameraRecorderProps {
  onVideoRecorded: () => void;
}

// Detect the best supported video MIME type for MediaRecorder
function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'video/webm';
}

export const CameraRecorder = ({ onVideoRecorded }: CameraRecorderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach stream to video element whenever both are available.
  // This runs every time isOpen changes or the stream ref changes.
  useEffect(() => {
    if (!isOpen || !streamRef.current) return;

    // The Dialog may need a tick to render the video element into the DOM
    const attach = () => {
      if (videoRef.current && streamRef.current) {
        if (videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch((err) => {
            console.warn('Video auto-play prevented:', err);
            // Browsers require a user interaction for play() in some cases;
            // autoPlay + muted attributes on the element handle this for previews.
          });
        }
        setCameraReady(true);
      }
    };

    // Try immediately, then after a microtask if videoRef isn't mounted yet
    attach();
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, cameraError]);

  const acquireCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 1280 },
          facingMode: 'user',
        },
        audio: true,
      });
      streamRef.current = stream;
      // Open the Dialog — the useEffect above will attach the stream once mounted
      setIsOpen(true);
    } catch (err: any) {
      console.error('Camera acquisition failed:', err);
      let message = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please allow camera access in your browser settings, then try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is in use by another application. Please close it and try again.';
      } else if (err.name === 'OverconstrainedError') {
        // Retry with looser constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = fallbackStream;
          setIsOpen(true);
          return;
        } catch {
          message = 'Camera does not support the requested resolution.';
        }
      }
      setCameraError(message);
      toast.error(message);
    }
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordingTime(0);

    const mimeType = getSupportedMimeType();
    console.log('Recording with MIME type:', mimeType);

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        // Stop all camera tracks after recording is done
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setShowEditor(true);
      };

      mediaRecorderRef.current = mediaRecorder;
      // Request data every 500ms so we don't lose the end chunk
      mediaRecorder.start(500);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
            // Auto-stop at 60 seconds
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('MediaRecorder error:', err);
      toast.error('Failed to start recording: ' + (err.message || 'Unknown error'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleClose = () => {
    // Stop all tracks and release resources
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setIsOpen(false);
    setIsRecording(false);
    setRecordedBlob(null);
    setShowEditor(false);
    setRecordingTime(0);
    setCameraReady(false);
    setCameraError(null);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Button onClick={acquireCamera} size="sm" variant="secondary" className="gap-1.5 text-xs shadow-lg">
        <Camera className="h-3.5 w-3.5" /> Record
      </Button>

      <Dialog open={isOpen && !showEditor} onOpenChange={handleClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-border">
          <div className="relative aspect-[9/16] max-h-[80vh] bg-black">
            {/* Live preview — autoPlay + muted required for browsers to allow preview without user gesture */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              // Mirror the front camera for a natural selfie view
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              onLoadedMetadata={() => setCameraReady(true)}
            />

            {/* Loading overlay while camera isn't ready */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-xs">Starting camera…</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6">
                <div className="text-center text-white space-y-3">
                  <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
                  <p className="text-sm font-medium">{cameraError}</p>
                  <Button size="sm" onClick={acquireCamera} className="text-xs">
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  REC
                </div>
                <div className="bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-mono backdrop-blur-sm">
                  {formatTime(recordingTime)}
                </div>
              </div>
            )}

            {/* Time warning */}
            {recordingTime >= 55 && (
              <div className="absolute top-4 right-4 bg-amber-500/90 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold z-10">
                {60 - recordingTime}s left
              </div>
            )}

            {/* Controls */}
            {cameraReady && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Start recording"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Stop recording"
                  >
                    <Square className="w-6 h-6 fill-red-500 text-red-500" />
                  </button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showEditor && recordedBlob && (
        <VideoEditor
          videoBlob={recordedBlob}
          onSave={() => {
            handleClose();
            onVideoRecorded();
          }}
          onClose={() => {
            setShowEditor(false);
            setRecordedBlob(null);
            // Re-acquire camera so user can record again
            acquireCamera();
          }}
        />
      )}
    </>
  );
};
