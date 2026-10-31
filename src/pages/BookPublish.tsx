import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, Image, FileText, Video, Check, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Product Info", icon: Package },
  { id: 2, label: "Pricing", icon: Sparkles },
  { id: 3, label: "Files", icon: Upload },
  { id: 4, label: "Review", icon: Check },
];

const categories = ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Engineering", "General"];
const productTypes = [
  { value: "book", label: "Book / eBook", desc: "PDF books and study guides" },
  { value: "video", label: "Video Course", desc: "Educational video content" },
  { value: "academic_material", label: "Academic Material", desc: "Notes, past questions, etc." },
];
const bookTypes = [
  { value: "digital", label: "Digital Only", desc: "Instant download after purchase" },
  { value: "paperback", label: "Paperback", desc: "Physical copy with delivery" },
];

export default function BookPublish() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [productType, setProductType] = useState("book");
  const [bookType, setBookType] = useState("digital");
  const [requiresDelivery, setRequiresDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const handleCoverChange = (file: File | null) => {
    setCoverImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverPreview(null);
    }
  };

  const canProceed = (s: number) => {
    if (s === 1) return title.trim() && category && productType;
    if (s === 2) return isFree || (price && parseFloat(price) > 0);
    if (s === 3) return !!pdfFile;
    return true;
  };

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let coverImageUrl = null;
      let pdfUrl = null;
      let videoUrl = null;

      if (coverImage) {
        const coverPath = `${user.id}/${Date.now()}_${coverImage.name}`;
        const { error: coverError } = await supabase.storage.from("book-covers").upload(coverPath, coverImage);
        if (coverError) throw coverError;
        const { data: { publicUrl } } = supabase.storage.from("book-covers").getPublicUrl(coverPath);
        coverImageUrl = publicUrl;
      }

      const pdfPath = `${user.id}/${Date.now()}_${pdfFile!.name}`;
      const { error: pdfError } = await supabase.storage.from("book-pdfs").upload(pdfPath, pdfFile!);
      if (pdfError) throw pdfError;
      pdfUrl = pdfPath;

      if (videoFile) {
        const videoPath = `${user.id}/${Date.now()}_${videoFile.name}`;
        const { error: videoError } = await supabase.storage.from("book-videos").upload(videoPath, videoFile);
        if (videoError) throw videoError;
        const { data: { publicUrl } } = supabase.storage.from("book-videos").getPublicUrl(videoPath);
        videoUrl = publicUrl;
      }

      const { error: bookError } = await supabase.from("books").insert([{
        author_id: user.id,
        title,
        description,
        category,
        price: isFree ? 0 : parseFloat(price),
        is_free: isFree,
        cover_image_url: coverImageUrl,
        pdf_url: pdfUrl,
        video_url: videoUrl,
        product_type: productType,
        book_type: productType === "book" ? bookType : "digital",
        requires_delivery: requiresDelivery,
        delivery_fee: requiresDelivery ? parseFloat(deliveryFee || "0") : 0,
        stock_quantity: requiresDelivery ? parseInt(stockQuantity || "0") : 0,
      }]);

      if (bookError) throw bookError;
      toast.success("Product submitted! It will appear on the marketplace after admin approval. 🎉");
      navigate("/marketplace/dashboard");
    } catch (error: any) {
      console.error("Error publishing:", error);
      toast.error(error.message || "Failed to publish");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Publish Product</h1>
            <p className="text-sm text-muted-foreground">Share your knowledge with the STEM community</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-10 px-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step > s.id ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  step >= s.id ? "text-foreground" : "text-muted-foreground"
                }`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                  step > s.id ? "bg-primary" : "bg-muted"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Product Info */}
        {step === 1 && (
          <Card className="p-6 md:p-8 space-y-6 border-border/50 bg-card/80 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-semibold mb-1">Product Information</h2>
              <p className="text-sm text-muted-foreground">Tell us about your product</p>
            </div>

            <div>
              <Label className="mb-2 block">Product Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {productTypes.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => {
                      setProductType(pt.value);
                      if (pt.value !== "book") setRequiresDelivery(false);
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      productType === pt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="font-medium text-sm">{pt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced Calculus Study Guide" className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will learners gain from this product?" rows={4} className="mt-1.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {productType === "book" && (
                <div>
                  <Label>Format</Label>
                  <Select value={bookType} onValueChange={(v) => { setBookType(v); setRequiresDelivery(v === "paperback"); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bookTypes.map((bt) => (
                        <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <Card className="p-6 md:p-8 space-y-6 border-border/50 bg-card/80 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-semibold mb-1">Pricing & Delivery</h2>
              <p className="text-sm text-muted-foreground">Set your pricing strategy</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
              <div>
                <p className="font-medium text-sm">Make this free</p>
                <p className="text-xs text-muted-foreground">Allow anyone to access without paying</p>
              </div>
              <Switch checked={isFree} onCheckedChange={setIsFree} />
            </div>

            {!isFree && (
              <div>
                <Label htmlFor="price">Price (₦) *</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 2500" min="0" step="100" className="mt-1.5 text-lg font-semibold" />
              </div>
            )}

            {requiresDelivery && (
              <div className="space-y-4 p-4 rounded-xl border border-dashed border-accent/50 bg-accent/5">
                <div className="flex items-center gap-2 text-accent">
                  <Package className="w-4 h-4" />
                  <p className="text-sm font-medium">Physical Delivery Options</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Delivery Fee (₦)</Label>
                    <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="1000" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Stock Quantity</Label>
                    <Input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="50" className="mt-1.5" />
                  </div>
                </div>
              </div>
            )}

            {!isFree && price && parseFloat(price) > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Buyers will pay</p>
                <p className="text-2xl font-bold text-primary">
                  ₦{parseFloat(price).toLocaleString()}
                  {requiresDelivery && deliveryFee && <span className="text-sm font-normal text-muted-foreground"> + ₦{parseFloat(deliveryFee).toLocaleString()} delivery</span>}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Step 3: Files */}
        {step === 3 && (
          <Card className="p-6 md:p-8 space-y-6 border-border/50 bg-card/80 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-semibold mb-1">Upload Files</h2>
              <p className="text-sm text-muted-foreground">Add your product files and cover image</p>
            </div>

            {/* Cover Image */}
            <div>
              <Label className="mb-2 block">Cover Image</Label>
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border hover:border-primary/50 rounded-xl cursor-pointer transition-colors bg-muted/30 overflow-hidden">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Image className="w-8 h-8" />
                    <span className="text-sm">Click to upload cover image</span>
                    <span className="text-xs">PNG, JPG up to 5MB</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverChange(e.target.files?.[0] || null)} />
              </label>
            </div>

            {/* Main File */}
            <div>
              <Label className="mb-2 block">
                {productType === "video" ? "Video File *" : "PDF File *"}
              </Label>
              <label className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                pdfFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"
              }`}>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${pdfFile ? "bg-primary/20" : "bg-muted"}`}>
                  <FileText className={`w-6 h-6 ${pdfFile ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  {pdfFile ? (
                    <>
                      <p className="font-medium text-sm">{pdfFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(pdfFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-sm text-muted-foreground">Click to upload {productType === "video" ? "video" : "PDF"}</p>
                      <p className="text-xs text-muted-foreground">{productType === "video" ? "MP4, MOV" : "PDF"} up to 50MB</p>
                    </>
                  )}
                </div>
                {pdfFile && <Check className="w-5 h-5 text-primary" />}
                <input type="file" accept={productType === "video" ? "video/*" : ".pdf"} className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            {/* Promo Video */}
            <div>
              <Label className="mb-2 block">Promotional Video (Optional)</Label>
              <label className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                videoFile ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 bg-muted/30"
              }`}>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${videoFile ? "bg-accent/20" : "bg-muted"}`}>
                  <Video className={`w-6 h-6 ${videoFile ? "text-accent" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  {videoFile ? (
                    <>
                      <p className="font-medium text-sm">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-sm text-muted-foreground">Click to upload promo video</p>
                      <p className="text-xs text-muted-foreground">Short preview video for buyers</p>
                    </>
                  )}
                </div>
                {videoFile && <Check className="w-5 h-5 text-accent" />}
                <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card className="p-6 md:p-8 space-y-6 border-border/50 bg-card/80 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-semibold mb-1">Review & Publish</h2>
              <p className="text-sm text-muted-foreground">Confirm everything looks good</p>
            </div>

            <div className="flex gap-5">
              {coverPreview && (
                <div className="w-28 h-36 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
                  <p className="font-semibold text-lg">{title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{productType.replace("_", " ")}</Badge>
                  <Badge variant="outline">{category}</Badge>
                  {productType === "book" && <Badge variant="outline">{bookType}</Badge>}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-bold text-lg">{isFree ? "Free" : `₦${parseFloat(price || "0").toLocaleString()}`}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Main File</p>
                <p className="font-medium text-sm truncate">{pdfFile?.name}</p>
              </div>
              {requiresDelivery && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className="font-bold text-lg">{stockQuantity || 0} units</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed(step)}
              className="gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={isLoading}
              className="gap-2 min-w-[160px]"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Publish Now
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
