import { useState, useRef, useEffect, useCallback } from "react";
import heroHomeworkImg from "@/assets/hero-homework.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Camera, Upload, Send, Volume2, X, Loader2, AlertCircle, SwitchCamera, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useFeatureAuth } from "@/hooks/useFeatureAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { handleError, withErrorHandling, handleFileUploadError, validateInput } from "@/lib/errorHandler";

export default function AIHomeworkHelper() {
  const navigate = useNavigate();
  const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("homework_helper");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [responseImage, setResponseImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // English audio
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState<string | null>(null); // Secondary language audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [homeworkHistory, setHomeworkHistory] = useState<any[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [capturedSnapshot, setCapturedSnapshot] = useState<{ dataUrl: string; file: File } | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  const [selectedLanguage, setSelectedLanguage] = useState<string>("none");
  const [translatedText, setTranslatedText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) {
      loadHomeworkHistory();
    }
  }, [user]);

  const loadHomeworkHistory = async () => {
    const result = await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from("homework_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHomeworkHistory(data || []);
    }, "loading homework history");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCapturedSnapshot(null);
    setIsCameraStarting(false);
    setShowCamera(false);
  };

  const startCameraStream = async (facing: "environment" | "user" = cameraFacing) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Camera access is not supported on this browser.");
      if (cameraInputRef.current) cameraInputRef.current.click();
      return;
    }

    setIsCameraStarting(true);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Autoplay notice:", playErr);
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error(err?.message || "Could not access camera. Please allow camera permissions or upload an image.");
      if (cameraInputRef.current) cameraInputRef.current.click();
      setShowCamera(false);
    } finally {
      setIsCameraStarting(false);
    }
  };

  const openCamera = async () => {
    setCapturedSnapshot(null);
    setShowCamera(true);
    await startCameraStream(cameraFacing);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    await startCameraStream(nextFacing);
  };

  const attachVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
        node.play().catch((err) => console.warn("Video play error:", err));
      }
    }
  }, []);

  useEffect(() => {
    if (!showCamera || !mediaStreamRef.current) return;
    const attach = () => {
      if (videoRef.current && mediaStreamRef.current) {
        if (videoRef.current.srcObject !== mediaStreamRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
        }
        videoRef.current.play().catch((err) => console.warn("Play error:", err));
      }
    };
    attach();
    const t = setTimeout(attach, 150);
    return () => clearTimeout(t);
  }, [showCamera]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `homework_${Date.now()}.jpg`, { type: "image/jpeg" });

    setCapturedSnapshot({ dataUrl, file });
  };

  const confirmCapturedSnapshot = () => {
    if (capturedSnapshot) {
      setImageFile(capturedSnapshot.file);
      setSelectedImage(capturedSnapshot.dataUrl);
      toast.success("Photo captured!");
    }
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedSnapshot(null);
    if (videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(console.warn);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    stopCamera();
  };

  // Helper to generate TTS with fallback voices — returns object URL or null
  const generateTTS = async (text: string) : Promise<string | null> => {
    if (!text) return null;

    const fallbackVoices = [
      "Adam", "Idera", "Emma", "Zainab", "Osagie", "Wura",
      "Jude", "Chinenye", "Tayo", "Regina", "Femi", "Adaora",
      "Umar", "Mary", "Nonso", "Remi"
    ];

    for (const voice of fallbackVoices) {
      try {
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke("text-to-speech", {
          body: {
            text,
            voice,
          },
        });

        if (ttsError) {
          const errString = JSON.stringify(ttsError);
          if (/Invalid Voice/i.test(errString) || /does not exist/i.test(errString)) {
            console.warn(`TTS voice "${voice}" invalid; trying next voice.`);
            continue;
          } else {
            console.error("TTS error:", ttsError);
            break;
          }
        }

        if (ttsData?.audioContent) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0))],
            { type: "audio/mp3" }
          );
          const url = URL.createObjectURL(audioBlob);
          return url;
        }
      } catch (e) {
        console.error("TTS request failed:", e);
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const promptError = validateInput(prompt, "Question");
    const imageError = !selectedImage ? "Please upload an image or enter a question" : null;

    if (promptError && imageError) {
      toast.error(imageError);
      return;
    }

    // Check auth before submitting - allow preview use but require auth to save
    const authRequired = checkAuthRequired("Log in to save your homework history and track your progress.");
    if (authRequired) {
      return;
    }

    setIsLoading(true);
    setResponse("");
    setResponseImage(null);
    setAudioUrl(null);
    setTranslatedAudioUrl(null);
    setTranslatedText(null);

    const result = await withErrorHandling(async () => {
      let imageBase64 = null;
      let imageUrl = null;

      if (imageFile && selectedImage) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("homework-images")
          .upload(fileName, imageFile);

        if (uploadError) {
          handleFileUploadError(uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("homework-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
        imageBase64 = selectedImage;
      }

      const { data, error } = await supabase.functions.invoke("ai-helper", {
        body: {
          prompt: prompt || "Please solve the problems shown in this image step by step.",
          type: "homework",
          imageBase64,
          userId: user.id,
        },
      });

      if (error) throw error;

      const rawText =
        data?.response ||
        data?.text ||
        data?.response_text ||
        (typeof data === "string" ? data : "") ||
        "";

      const aiResponse = rawText ? formatResponse(rawText) : "";
      setResponse(aiResponse);

      // Handle image outputs (base64 or url)
      if (data?.response_image_base64) {
        let base = data.response_image_base64;
        if (!base.startsWith("data:")) {
          base = `data:image/png;base64,${base}`;
        }
        setResponseImage(base);
      } else if (data?.response_image_url) {
        setResponseImage(data.response_image_url);
      }

      // Generate English audio (always) using generateTTS
      if (aiResponse) {
        const englishAudio = await generateTTS(aiResponse);
        if (englishAudio) {
          setAudioUrl(englishAudio);
        } else {
          toast.error("Failed to generate English audio");
        }
      }

      // If user selected another language, request a translation and generate TTS for it.
      if (selectedLanguage && selectedLanguage !== "none" && aiResponse) {
        const translateResult = await withErrorHandling(async () => {
          // Ask AI to translate the response to the selected language
          const translatePrompt = `Translate the following text to ${selectedLanguage} preserving the meaning and formatting:\n\n${aiResponse}`;
          const { data: tData, error: tErr } = await supabase.functions.invoke("ai-helper", {
            body: {
              prompt: translatePrompt,
              type: "translate",
              userId: user.id,
            },
          });

          if (tErr) throw tErr;

          const translatedRaw =
            tData?.response ||
            tData?.text ||
            tData?.response_text ||
            (typeof tData === "string" ? tData : "") ||
            "";

          if (translatedRaw) {
            const translated = formatResponse(translatedRaw);
            setTranslatedText(translated);

            // Generate TTS for translated text
            const otherAudio = await generateTTS(translated);
            if (otherAudio) {
              setTranslatedAudioUrl(otherAudio);
            } else {
              console.warn("Failed to generate audio for translated text.");
            }
          }
        }, "translation");
      }

      // Reload history
      loadHomeworkHistory();

      toast.success("Solution generated successfully!");
    }, "homework assistance");

    setIsLoading(false);
  };

  const formatResponse = (text: string) => {
    // Remove markdown bold/italic asterisks, but preserve math
    let formatted = text.replace(/\*\*/g, '');
    formatted = formatted.replace(/\*/g, '');
    // Do NOT replace $...$ with $$...$$, keep inline math as $...$
    // Remove accidental double-dollar for inline
    formatted = formatted.replace(/\$\$(.*?)\$\$/gs, '$$$1$$');
    // Remove extra whitespace before/after math
    formatted = formatted.replace(/\s*\$\s*/g, '$');
    return formatted;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const viewSavedSession = (session: any) => {
    setPrompt(session.question_text || "");
    setResponse(session.response_text || "");
    setSelectedImage(session.question_image_url || null);
    setResponseImage(session.response_image_url || session.response_image_base64 || null);
    setAudioUrl(session.response_audio_url || null);
    setTranslatedAudioUrl(session.response_audio_translated_url || null);
    setTranslatedText(session.response_text_translated || null);
    setImageFile(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">AI Homework Helper</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <PageHeroBanner image={heroHomeworkImg} title="AI Homework Helper" subtitle="Snap photos of problems and get instant step-by-step solutions" badge="AI Powered" />
      </div>

      <main className="max-w-7xl mx-auto p-6">
        {!user && isPreviewAvailable && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You're trying this feature as a preview. You can use it once without logging in. <strong>Your homework history won't be saved</strong> unless you sign in.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="solve" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
            <TabsTrigger value="solve">Solve Problem</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="solve" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Your Question</h2>

                {/* Language selector (optional) */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Optional translated audio:</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="ml-2 rounded p-2 bg-popover text-foreground"
                  >
                    <option value="none">None</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Yoruba">Yoruba</option>
                    <option value="Hausa">Hausa</option>
                    <option value="Igbo">Igbo</option>
                    <option value="Swahili">Swahili</option>
                  </select>
                </div>

                <Textarea
                  placeholder="Type your homework question here or upload an image..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[200px] resize-none"
                />

                {selectedImage && (
                  <div className="relative">
                    <img
                      src={selectedImage}
                      alt="Selected"
                      className="w-full rounded-lg border border-border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={openCamera}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isLoading || (!prompt && !selectedImage)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Solving...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Get Solution
                    </>
                  )}
                </Button>
              </Card>

              {/* Response Section */}
              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">AI Solution</h2>

                {response || responseImage ? (
                  <>
                    {response && (
                      <div className="prose prose-sm max-w-none bg-muted p-4 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto text-foreground">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {response}
                        </ReactMarkdown>
                      </div>
                    )}

                    {responseImage && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">AI Image Output</p>
                        <img src={responseImage} alt="AI output" className="w-full rounded-lg border border-border object-contain" />
                      </div>
                    )}

                    {/* English audio playback */}
                    {audioUrl && (
                      <div className="flex items-center gap-2 mt-4">
                        <audio
                          ref={audioRef}
                          src={audioUrl}
                          onEnded={() => setIsPlaying(false)}
                          className="hidden"
                        />
                        <Button
                          onClick={toggleAudio}
                          className="flex-1 bg-primary hover:bg-primary/90"
                          size="lg"
                        >
                          <Volume2 className="w-5 h-5 mr-2" />
                          {isPlaying ? "Pause English Audio" : "Play English Audio"}
                        </Button>
                      </div>
                    )}

                    {/* Translated text and audio */}
                    {translatedText && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-1">Translated ({selectedLanguage})</p>
                        <div className="prose prose-sm max-w-none bg-muted p-3 rounded-lg text-foreground">
                          <ReactMarkdown>{translatedText}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {translatedAudioUrl && (
                      <div className="flex items-center gap-2 mt-4">
                        <audio
                          src={translatedAudioUrl}
                          onEnded={() => setIsPlaying(false)}
                          controls
                          className="w-full"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
                    {isLoading ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>AI is solving your problem...</p>
                      </div>
                    ) : (
                      <p>Your solution will appear here</p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Saved Sessions</h2>

              {homeworkHistory.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No saved homework sessions yet</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {homeworkHistory.map((session) => (
                    <Card
                      key={session.id}
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => viewSavedSession(session)}
                    >
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()} at{" "}
                          {new Date(session.created_at).toLocaleTimeString()}
                        </p>
                        {session.question_image_url && (
                          <img
                            src={session.question_image_url}
                            alt="Question"
                            className="w-full h-32 object-cover rounded"
                          />
                        )}
                        <p className="text-sm font-medium line-clamp-2">
                          {session.question_text || "Image-based question"}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {session.response_text}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Camera modal UI */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="max-w-2xl w-full p-4 relative bg-card border-border shadow-2xl flex flex-col gap-3">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {capturedSnapshot ? "Review Captured Photo" : "Snap Homework Question"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!capturedSnapshot && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleCameraFacing}
                    title="Switch front/back camera"
                    className="text-xs gap-1 border-border/60"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    Flip
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={stopCamera} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Video Viewport / Captured Preview */}
            <div className="relative w-full h-[60vh] max-h-[500px] bg-black rounded-xl overflow-hidden flex items-center justify-center border border-border/40">
              {isCameraStarting && !capturedSnapshot && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Initializing camera...</p>
                </div>
              )}

              {capturedSnapshot ? (
                <img
                  src={capturedSnapshot.dataUrl}
                  alt="Captured problem"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={attachVideoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  playsInline
                  muted
                />
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2 pt-1">
              {capturedSnapshot ? (
                <>
                  <Button
                    variant="outline"
                    onClick={retakePhoto}
                    className="flex-1 gap-1.5 border-border/60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retake
                  </Button>
                  <Button
                    onClick={confirmCapturedSnapshot}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 glow-primary"
                  >
                    <Check className="w-4 h-4" />
                    Use Photo
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="flex-1 border-border/60"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={capturePhoto}
                    disabled={isCameraStarting}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 glow-primary"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </Button>
                </>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </Card>
        </div>      )}
    </div>
  );
}
