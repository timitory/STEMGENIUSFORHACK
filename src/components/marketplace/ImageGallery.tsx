import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
  coverImage?: string | null;
  title: string;
}

export function ImageGallery({ images, coverImage, title }: ImageGalleryProps) {
  const allImages = [coverImage, ...images].filter(Boolean) as string[];
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  if (allImages.length === 0) {
    return (
      <div className="aspect-square bg-muted rounded-xl flex items-center justify-center">
        <div className="text-6xl opacity-20">📦</div>
      </div>
    );
  }

  const goNext = () => setActiveIndex((i) => (i + 1) % allImages.length);
  const goPrev = () => setActiveIndex((i) => (i - 1 + allImages.length) % allImages.length);

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
        <img
          src={allImages[activeIndex]}
          alt={`${title} - Image ${activeIndex + 1}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <button
          onClick={() => setZoomOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn className="w-4 h-4 text-foreground" />
        </button>
        {allImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                i === activeIndex
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border opacity-60 hover:opacity-100"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur-xl">
          <img
            src={allImages[activeIndex]}
            alt={title}
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
