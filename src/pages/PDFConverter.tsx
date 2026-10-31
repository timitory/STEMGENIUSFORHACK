import { useState, useRef, useEffect, useCallback } from "react";
import heroPdfConverterImg from "@/assets/hero-pdf-converter.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Headphones, Video, Loader2, ChevronLeft, ChevronRight, Play, Pause, Download, Clock, History, RefreshCw, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { handleError, withErrorHandling, handleFileUploadError } from "@/lib/errorHandler";

interface ConversionRecord {
  id: string;
  pdf_url: string;
  conversion_type: string;
  status: string;
  audio_url: string | null;
  video_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function PDFConverter() {
   const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [conversionType, setConversionType] = useState<"audio" | "video">("audio");
  const [activeTab, setActiveTab] = useState("convert");

  // History state
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Slideshow state
  const [slidePages, setSlidePages] = useState<string[]>([]);
  const [slideAudioUrl, setSlideAudioUrl] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("pdf_conversions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory((data as ConversionRecord[]) || []);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setAudioUrl(null);
      setTextPreview(null);
      setSlidePages([]);
      setSlideAudioUrl(null);
      setCurrentSlide(0);
      setIsPlaying(false);
    } else {
      toast.error("Please select a valid PDF file");
    }
  };

  const handleConvert = async () => {
    if (!pdfFile) {
      toast.error("Please select a PDF file first");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login to convert PDFs");
      return;
    }

    setIsConverting(true);

    const result = await withErrorHandling(async () => {
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("pdf-conversions")
        .upload(fileName, pdfFile);

      if (uploadError) {
        handleFileUploadError(uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("pdf-conversions")
        .getPublicUrl(fileName);

      const { data: conversionData, error: insertError } = await supabase
        .from("pdf_conversions")
        .insert({
          user_id: user.id,
          pdf_url: publicUrl,
          conversion_type: conversionType,
          status: "processing",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data, error } = await supabase.functions.invoke("pdf-converter", {
        body: { pdfUrl: publicUrl, conversionType },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (conversionType === "audio" && data.audioContent) {
        const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setTextPreview(data.textPreview || null);

        // Upload audio to storage for history
        const audioFileName = `${user.id}/${Date.now()}-audio.mp3`;
        await supabase.storage.from("pdf-conversions").upload(audioFileName, audioBlob);
        const { data: { publicUrl: savedAudioUrl } } = supabase.storage.from("pdf-conversions").getPublicUrl(audioFileName);

        await supabase
          .from("pdf_conversions")
          .update({ status: "completed", completed_at: new Date().toISOString(), audio_url: savedAudioUrl })
          .eq("id", conversionData.id);

        toast.success("PDF converted to audio successfully!");
      } else if (conversionType === "video" && data.audioContent && data.pages) {
        const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setSlideAudioUrl(url);
        setSlidePages(data.pages);
        setCurrentSlide(0);

        const audioFileName = `${user.id}/${Date.now()}-narration.mp3`;
        await supabase.storage.from("pdf-conversions").upload(audioFileName, audioBlob);
        const { data: { publicUrl: savedAudioUrl } } = supabase.storage.from("pdf-conversions").getPublicUrl(audioFileName);

        await supabase
          .from("pdf_conversions")
          .update({ status: "completed", completed_at: new Date().toISOString(), audio_url: savedAudioUrl })
          .eq("id", conversionData.id);

        toast.success("PDF converted to slideshow successfully!");
      }
    }, "PDF conversion");

    setIsConverting(false);
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const toggleSlideshow = useCallback(() => {
    if (!slideAudioUrl || slidePages.length === 0) return;
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    } else {
      setIsPlaying(true);
      audioRef.current?.play();
      const audioDuration = audioRef.current?.duration || 30;
      const interval = (audioDuration / slidePages.length) * 1000;
      slideTimerRef.current = setInterval(() => {
        setCurrentSlide(prev => {
          if (prev >= slidePages.length - 1) {
            setIsPlaying(false);
            audioRef.current?.pause();
            if (slideTimerRef.current) clearInterval(slideTimerRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, Math.max(interval, 3000));
    }
  }, [isPlaying, slideAudioUrl, slidePages.length]);

  useEffect(() => {
    return () => { if (slideTimerRef.current) clearInterval(slideTimerRef.current); };
  }, []);

  useEffect(() => {
    if (slideAudioUrl && audioRef.current) {
      audioRef.current.src = slideAudioUrl;
      audioRef.current.load();
    }
  }, [slideAudioUrl]);

  const slideProgress = slidePages.length > 0 ? ((currentSlide + 1) / slidePages.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-6">
       <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
      <div className="max-w-4xl mx-auto">
        <PageHeroBanner image={heroPdfConverterImg} title="PDF to Audio/Video Converter" subtitle="Convert your PDF documents into audio or narrated slideshows for easy learning" badge="Convert" />

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="convert" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Convert
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="convert" className="mt-6">
              <Tabs value={conversionType} onValueChange={(v) => setConversionType(v as "audio" | "video")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="audio" className="flex items-center gap-2">
                    <Headphones className="w-4 h-4" />
                    Audio
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Narrated Slides
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="audio" className="mt-6">
                  <Card className="p-6">
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="pdf-upload">Upload PDF Document</Label>
                        <p className="text-sm text-muted-foreground mb-2">Upload a PDF and we'll extract the text and convert it to spoken audio</p>
                        <div className="mt-2">
                          <Input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
                        </div>
                        {pdfFile && (
                          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>

                      <Button onClick={handleConvert} disabled={!pdfFile || isConverting} className="w-full" size="lg">
                        {isConverting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting text & generating audio...</>
                        ) : (
                          <><Headphones className="mr-2 h-4 w-4" />Convert to Audio</>
                        )}
                      </Button>

                      {audioUrl && (
                        <Card className="p-4 bg-secondary/50">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Headphones className="w-4 h-4 text-primary" />
                            Converted Audio
                          </h3>
                          {textPreview && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{textPreview}...</p>}
                          <audio controls className="w-full">
                            <source src={audioUrl} type="audio/mp3" />
                          </audio>
                          <Button variant="outline" className="w-full mt-3" onClick={() => {
                            const a = document.createElement('a');
                            a.href = audioUrl;
                            a.download = `${pdfFile?.name?.replace('.pdf', '') || 'converted'}-audio.mp3`;
                            a.click();
                          }}>
                            <Download className="mr-2 h-4 w-4" />Download Audio
                          </Button>
                        </Card>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="video" className="mt-6">
                  <Card className="p-6">
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="pdf-upload-video">Upload PDF Document</Label>
                        <p className="text-sm text-muted-foreground mb-2">Upload a PDF and we'll create a narrated slideshow with text highlights synced to audio</p>
                        <div className="mt-2">
                          <Input id="pdf-upload-video" type="file" accept="application/pdf" onChange={handleFileChange} />
                        </div>
                        {pdfFile && (
                          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>

                      <Button onClick={handleConvert} disabled={!pdfFile || isConverting} className="w-full" size="lg">
                        {isConverting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting text & creating slideshow...</>
                        ) : (
                          <><Video className="mr-2 h-4 w-4" />Convert to Narrated Slides</>
                        )}
                      </Button>

                      {slidePages.length > 0 && slideAudioUrl && (
                        <Card className="overflow-hidden border-2 border-primary/20">
                          <audio ref={audioRef} preload="metadata" />
                          <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 min-h-[300px] flex items-center justify-center">
                            <div className="max-w-xl text-center">
                              <p className="text-lg md:text-xl leading-relaxed font-medium">{slidePages[currentSlide]}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-muted/50 space-y-3">
                            <Progress value={slideProgress} className="h-1.5" />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Slide {currentSlide + 1} of {slidePages.length}</span>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={toggleSlideshow} className="px-4">
                                  {isPlaying ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Play</>}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setCurrentSlide(Math.min(slidePages.length - 1, currentSlide + 1))} disabled={currentSlide >= slidePages.length - 1}>
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => {
                                const a = document.createElement('a');
                                a.href = slideAudioUrl;
                                a.download = `${pdfFile?.name?.replace('.pdf', '') || 'converted'}-narration.mp3`;
                                a.click();
                              }}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Conversion History
                  </h3>
                  <Button variant="outline" size="sm" onClick={loadHistory} disabled={isLoadingHistory}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No conversions yet</p>
                    <p className="text-sm mt-1">Convert a PDF to see your history here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <Card key={item.id} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {item.conversion_type === "audio" ? (
                              <Headphones className="w-5 h-5 text-primary" />
                            ) : (
                              <Video className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.pdf_url.split('/').pop()?.split('?')[0] || 'PDF Document'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant={item.status === "completed" ? "default" : item.status === "processing" ? "secondary" : "destructive"} className="text-[10px] h-5">
                                {item.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), "MMM d, yyyy · h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.audio_url && item.status === "completed" && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const a = document.createElement('a');
                              a.href = item.audio_url!;
                              a.download = 'converted-audio.mp3';
                              a.target = '_blank';
                              a.click();
                            }}>
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Audio
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
