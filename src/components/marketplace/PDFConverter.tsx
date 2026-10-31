import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileAudio, Loader2 } from "lucide-react";

export const PDFConverter = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login to convert PDFs");
      return;
    }

    if (!pdfFile) {
      toast.error("Please select a PDF file");
      return;
    }

    setIsConverting(true);

    try {
      // Upload PDF to storage
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("pdf-conversions")
        .upload(fileName, pdfFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("pdf-conversions")
        .getPublicUrl(fileName);

      // Create conversion record
      const { data: conversion, error: insertError } = await supabase
        .from("pdf_conversions")
        .insert({
          user_id: user.id,
          pdf_url: publicUrl,
          conversion_type: "audio",
          status: "processing",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to convert
      const { data, error: conversionError } = await supabase.functions.invoke(
        "pdf-converter",
        {
          body: {
            pdfUrl: publicUrl,
            conversionType: "audio",
          },
        }
      );

      if (conversionError) throw conversionError;

      // Save audio file
      const audioFileName = `${user.id}/${Date.now()}.mp3`;
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );

      const { error: audioUploadError } = await supabase.storage
        .from("pdf-conversions")
        .upload(audioFileName, audioBlob);

      if (audioUploadError) throw audioUploadError;

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from("pdf-conversions")
        .getPublicUrl(audioFileName);

      // Update conversion record
      await supabase
        .from("pdf_conversions")
        .update({
          audio_url: audioUrl,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", conversion.id);

      toast.success("PDF converted to audio successfully!");
      
      // Download audio
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = "converted_audio.mp3";
      link.click();

      setPdfFile(null);

    } catch (error) {
      console.error(error);
      toast.error("Failed to convert PDF");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileAudio className="h-5 w-5" />
        <h3 className="text-lg font-semibold">PDF to Audio Converter</h3>
      </div>
      <div className="space-y-4">
        <Input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
        />
        <Button 
          onClick={handleConvert} 
          disabled={isConverting || !pdfFile}
          className="w-full"
        >
          {isConverting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            "Convert to Audio"
          )}
        </Button>
      </div>
    </Card>
  );
};