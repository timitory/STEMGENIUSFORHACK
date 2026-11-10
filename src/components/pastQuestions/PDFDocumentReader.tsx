import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FileText, ZoomIn, ZoomOut, Sparkles, CheckCircle2, BookOpen,
  ShieldCheck, X, Loader2, AlertCircle, RefreshCw, Maximize2,
  ChevronLeft, ChevronRight, Minimize2
} from "lucide-react";
import { PastQuestionCollection } from "@/types/pastQuestions";
import { supabase } from "@/integrations/supabase/client";

// Extend Window for pdfjsLib
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface PDFDocumentReaderProps {
  collection: PastQuestionCollection | null;
  isOpen: boolean;
  onClose: () => void;
  onStartInteractivePractice?: (collection: PastQuestionCollection) => void;
  initialDocType?: "question" | "answers" | "marking_scheme";
}

export function PDFDocumentReader({
  collection,
  isOpen,
  onClose,
  onStartInteractivePractice,
  initialDocType = "question",
}: PDFDocumentReaderProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeDocType, setActiveDocType] = useState<"question" | "answers" | "marking_scheme">(initialDocType);
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // PDF.js-specific state
  const [pdfLibReady, setPdfLibReady] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpToPage, setJumpToPage] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartX = useRef<number>(0);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Set default zoom for mobile (fit-width style = 100 looks okay, we'll use device scale)
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(isMobile ? 100 : 100);
    }
  }, [isOpen, isMobile]);

  // Dynamically load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      setPdfLibReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = PDFJS_CDN;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        setPdfLibReady(true);
      }
    };
    script.onerror = () => {
      console.error("Failed to load PDF.js from CDN");
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    setActiveDocType(initialDocType || "question");
  }, [initialDocType, isOpen]);

  useEffect(() => {
    if (!collection || !isOpen) {
      setResolvedUrl("");
      setPdfError(null);
      setIsLoadingPdf(false);
      pdfDocRef.current = null;
      setCurrentPage(1);
      setTotalPages(0);
      return;
    }

    let isMounted = true;
    let activeBlobUrl: string | null = null;

    async function loadDocument() {
      setIsLoadingPdf(true);
      setPdfError(null);
      pdfDocRef.current = null;
      setCurrentPage(1);
      setTotalPages(0);

      try {
        let rawPath = collection!.document_url;
        if (activeDocType === "answers" && collection!.answers_document_url) {
          rawPath = collection!.answers_document_url;
        } else if (activeDocType === "marking_scheme" && collection!.marking_scheme_document_url) {
          rawPath = collection!.marking_scheme_document_url;
        }

        if (!rawPath || !rawPath.trim()) {
          throw new Error(`No separate ${activeDocType.replace("_", " ")} document was attached by the compiler.`);
        }

        rawPath = rawPath.trim();
        let downloadUrl = rawPath;

        if (!rawPath.startsWith("http://") && !rawPath.startsWith("https://")) {
          const { data, error } = await supabase.storage
            .from("past-question-pdfs")
            .createSignedUrl(rawPath, 3600);

          if (error || !data?.signedUrl) {
            throw new Error(error?.message || "Could not retrieve document from secure storage.");
          }
          downloadUrl = data.signedUrl;
        }

        try {
          const response = await fetch(downloadUrl);
          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
          }
          const buffer = await response.blob();
          const pdfBlob = new Blob([buffer], { type: "application/pdf" });
          const objectUrl = URL.createObjectURL(pdfBlob);
          activeBlobUrl = objectUrl;

          if (isMounted) {
            setResolvedUrl(objectUrl);
          }
        } catch (fetchErr) {
          console.warn("Direct blob fetch failed, falling back to direct URL:", fetchErr);
          if (isMounted) {
            setResolvedUrl(downloadUrl);
          }
        }
      } catch (err: any) {
        console.error("PDF loading error:", err);
        if (isMounted) {
          setPdfError(err?.message || "Failed to load document content.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPdf(false);
        }
      }
    }

    loadDocument();

    return () => {
      isMounted = false;
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [collection, isOpen, activeDocType]);

  // Load PDF document via PDF.js when URL is ready
  useEffect(() => {
    if (!resolvedUrl || !pdfLibReady || !window.pdfjsLib) return;

    let cancelled = false;

    async function loadPdfDoc() {
      try {
        const loadingTask = window.pdfjsLib.getDocument(resolvedUrl);
        const pdfDoc = await loadingTask.promise;
        if (!cancelled) {
          pdfDocRef.current = pdfDoc;
          setTotalPages(pdfDoc.numPages);
          setCurrentPage(1);
        }
      } catch (err: any) {
        console.error("PDF.js load error:", err);
        if (!cancelled) {
          setPdfError("Failed to parse PDF document. The file may be corrupted or unsupported.");
        }
      }
    }

    loadPdfDoc();

    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, pdfLibReady]);

  // Render current page onto canvas
  const renderPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (_) { /* ignore */ }
      renderTaskRef.current = null;
    }

    setIsRenderingPage(true);

    try {
      const page = await pdfDocRef.current.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const unscaledViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current
        ? containerRef.current.clientWidth - (isMobile ? 12 : 36)
        : (window.innerWidth - (isMobile ? 16 : 48));

      // Calculate fit-to-width base scale so margins and edges are never cut off on mobile devices
      const fitWidthScale = Math.max(containerWidth / unscaledViewport.width, 0.35);
      const baseScale = isMobile ? fitWidthScale : Math.min(1.25, fitWidthScale);
      const finalDisplayScale = baseScale * (zoomLevel / 100);

      // High-DPI crisp sharpness for mobile Retina and desktop screens
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
      const renderScale = finalDisplayScale * pixelRatio;
      const viewport = page.getViewport({ scale: renderScale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Page render error:", err);
      }
    } finally {
      setIsRenderingPage(false);
    }
  }, [currentPage, zoomLevel, isMobile]);

  // Re-render whenever page or zoom changes and doc is loaded
  useEffect(() => {
    if (pdfDocRef.current && totalPages > 0) {
      renderPage();
    }
  }, [currentPage, zoomLevel, totalPages, renderPage]);

  if (!collection) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 50));
  const handleFitWidth = () => setZoomLevel(100);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jumpToPage, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      setCurrentPage(n);
      setJumpToPage("");
    }
  };

  const handleOpenFullScreen = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, "_blank");
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 55) {
      if (diff > 0) handleNextPage();
      else handlePrevPage();
    }
  };

  const isPdfJsReady = pdfLibReady && pdfDocRef.current && totalPages > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[100vw] w-screen h-[100dvh] sm:max-w-[99vw] sm:w-[99vw] sm:h-[98vh] p-0 flex flex-col bg-background/95 backdrop-blur-xl border border-border/80 overflow-hidden shadow-2xl select-none rounded-none sm:rounded-xl"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* HEADER TOOLBAR */}
        <DialogHeader className="h-14 sm:h-16 px-3 sm:px-6 border-b border-border/60 bg-card/60 flex flex-row items-center justify-between shrink-0 m-0">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <DialogTitle className="text-xs sm:text-base font-bold text-foreground truncate max-w-[160px] xs:max-w-xs sm:max-w-md">
                  {collection.title}
                </DialogTitle>
                <Badge variant="outline" className="text-[9px] sm:text-[10px] text-accent border-accent/40 hidden sm:inline-flex shrink-0">
                  {collection.course_code || collection.subject}
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex items-center gap-1 sm:gap-2 mt-0.5">
                <span>By: <strong className="text-foreground">{collection.compiler_name}</strong></span>
                {collection.academic_level && (
                  <>
                    <span>•</span>
                    <span>{collection.academic_level}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* ACTION CONTROLS */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-secondary/60 rounded-lg p-0.5 border border-border/60">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleFitWidth}
                className="h-7 w-7 text-[10px]"
                title="Fit Width (100%)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="h-7 w-7 text-xs"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-mono px-1.5 text-muted-foreground">
                {zoomLevel}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 250}
                className="h-7 w-7 text-xs"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Full Screen (opens in new tab) */}
            {resolvedUrl && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleOpenFullScreen}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Open in new tab (Full Screen)"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            )}

            {/* Interactive CBT Mode Trigger */}
            {onStartInteractivePractice && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onStartInteractivePractice(collection);
                }}
                className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 glow-primary"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Practise CBT</span>
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* DOCUMENT TYPE SELECTOR TABS */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-secondary/30 border-b border-border/40 shrink-0 overflow-x-auto no-scrollbar">
          <Button
            size="sm"
            variant={activeDocType === "question" ? "default" : "outline"}
            onClick={() => setActiveDocType("question")}
            className="h-7 text-xs gap-1.5 border-border/60"
          >
            <FileText className="w-3.5 h-3.5" />
            Exam Question Paper
          </Button>

          {(collection.answers_document_url || collection.has_answers) && (
            <Button
              size="sm"
              variant={activeDocType === "answers" ? "default" : "outline"}
              onClick={() => setActiveDocType("answers")}
              className={`h-7 text-xs gap-1.5 border-emerald-500/40 ${
                activeDocType === "answers" ? "bg-emerald-600 text-white" : "text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Answers &amp; Solutions PDF
            </Button>
          )}

          {(collection.marking_scheme_document_url || collection.has_marking_scheme) && (
            <Button
              size="sm"
              variant={activeDocType === "marking_scheme" ? "default" : "outline"}
              onClick={() => setActiveDocType("marking_scheme")}
              className={`h-7 text-xs gap-1.5 border-blue-500/40 ${
                activeDocType === "marking_scheme" ? "bg-blue-600 text-white" : "text-blue-400 hover:bg-blue-500/10"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Marking Scheme / Rubric PDF
            </Button>
          )}
        </div>

        {/* MAIN VIEWER CONTAINER */}
        <div className="flex-1 bg-black/40 relative overflow-hidden flex flex-col items-center">
          {/* Loading state: fetching doc or loading PDF.js */}
          {(isLoadingPdf || (!pdfLibReady && !pdfError)) ? (
            <div className="flex flex-col items-center gap-3 text-center p-6 m-auto">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {isLoadingPdf
                  ? `Loading ${activeDocType === "answers" ? "Answer Guide" : activeDocType === "marking_scheme" ? "Marking Scheme" : "Examination Paper"}...`
                  : "Initializing PDF renderer..."}
              </p>
              <p className="text-xs text-muted-foreground">Preparing secured document stream...</p>
            </div>
          ) : pdfError ? (
            <div className="max-w-md p-6 text-center space-y-4 m-auto">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h3 className="text-base font-bold text-foreground">Document Unavailable</h3>
              <p className="text-xs text-muted-foreground">{pdfError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveDocType("question")}
                className="text-xs border-border/60 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Return to Question Paper
              </Button>
            </div>
          ) : resolvedUrl ? (
            <>
              {/* Canvas scroll area */}
              <div
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="flex-1 w-full overflow-auto flex items-start justify-center p-1 sm:p-4 relative touch-pan-y"
              >
                {isRenderingPage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="rounded shadow-xl bg-white max-w-full"
                  style={{ display: isPdfJsReady ? "block" : "none" }}
                />
                {/* Fallback: PDF.js hasn't parsed the doc yet */}
                {!isPdfJsReady && !isRenderingPage && (
                  <div className="flex flex-col items-center gap-3 m-auto">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Parsing document pages...</p>
                  </div>
                )}
              </div>

              {/* Pagination + zoom controls bar */}
              {isPdfJsReady && (
                <div className="shrink-0 w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-2 bg-card/80 border-t border-border/40 backdrop-blur-sm">
                  {/* Prev / Page X of Y / Next */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handlePrevPage}
                      disabled={currentPage <= 1}
                      className="h-7 w-7"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                      className="h-7 w-7"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Jump to page */}
                  <form onSubmit={handleJumpToPage} className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpToPage}
                      onChange={(e) => setJumpToPage(e.target.value)}
                      placeholder="Go to"
                      className="h-7 w-16 text-xs bg-secondary/40 border-border/60 text-center"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-border/60 px-2"
                    >
                      Go
                    </Button>
                  </form>

                  {/* Mobile zoom controls */}
                  <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-0.5 border border-border/60">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleFitWidth}
                      className="h-6 w-6"
                      title="Fit Width"
                    >
                      <Minimize2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomOut}
                      disabled={zoomLevel <= 50}
                      className="h-6 w-6"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </Button>
                    <span className="text-[10px] font-mono px-1 text-muted-foreground">{zoomLevel}%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomIn}
                      disabled={zoomLevel >= 200}
                      className="h-6 w-6"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* BOTTOM WATERMARK FOOTER */}
        <div className="h-10 px-4 sm:px-6 bg-card/80 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>Official University Past Question Library • STEM Genius</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Current view: <strong className="text-foreground capitalize">{activeDocType.replace("_", " ")}</strong></span>
            <span>•</span>
            <span>Protected View</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
