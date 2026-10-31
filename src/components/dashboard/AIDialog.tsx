import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, Upload, Volume2, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface AIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "homework" | "tutor";
}

export function AIDialog({ open, onOpenChange, title, type }: AIDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && !imageFile) {
      toast.error("Please enter a question or upload an image");
      return;
    }

    setIsLoading(true);
    setResponse("");
    setAudioBase64(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let imageBase64 = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      // Get AI response
      const { data, error } = await supabase.functions.invoke("ai-helper", {
        body: { 
          prompt, 
          type,
          imageBase64,
          userId: user?.id
        },
      });

      if (error) throw error;

      setResponse(data.response);

      // Generate audio for homework type
      if (type === "homework") {
        try {
          const { data: audioData, error: audioError } = await supabase.functions.invoke("text-to-speech", {
            body: { text: data.response, voice: "alloy" },
          });

          if (audioError) throw audioError;
          setAudioBase64(audioData.audioContent);
        } catch (audioError: any) {
          console.error("TTS Error:", audioError);
          toast.error("Response generated, but audio failed");
        }
      }

      toast.success("Solution generated successfully!");
    } catch (error: any) {
      console.error("AI Helper Error:", error);
      toast.error(error.message || "Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = () => {
    if (!audioBase64 || !audioRef.current) return;

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.src = `data:audio/mp3;base64,${audioBase64}`;
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {type === "homework" && (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>
            </div>
          )}

          {imagePreview && (
            <Card className="p-4">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Question"
                  className="w-full rounded-lg max-h-64 object-contain"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2"
                >
                  Remove
                </Button>
              </div>
            </Card>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {type === "homework" ? "Describe the problem (optional if image uploaded)" : "What would you like to learn about?"}
            </label>
            <Textarea
              placeholder={
                type === "homework" 
                  ? "E.g., Solve problem #2 or describe what you need help with" 
                  : "E.g., Explain Newton's laws of motion"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating solution...
              </>
            ) : (
              "Get Help"
            )}
          </Button>

          {response && (
            <div className="mt-4 p-4 bg-secondary rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">AI Solution:</h4>
                {audioBase64 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlayAudio}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Audio
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Play Audio
                      </>
                    )}
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{response}</p>
              <audio
                ref={audioRef}
                onEnded={handleAudioEnded}
                className="hidden"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
