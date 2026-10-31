import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, ShoppingCart, Truck, Lock, Eye, Star, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageGallery } from "@/components/marketplace/ImageGallery";
import { OrderChat } from "@/components/marketplace/OrderChat";
import { PurchaseSuccessModal } from "@/components/marketplace/PurchaseSuccessModal";

export default function BookReader() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [book, setBook] = useState<any>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [purchaseRecord, setPurchaseRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [sellerName, setSellerName] = useState("Seller");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: "",
    city: "",
    state: "",
    phone: "",
  });

  useEffect(() => {
    if (bookId) {
      const paymentStatus = searchParams.get("payment");
      const sessionId = searchParams.get("session_id");

      if (paymentStatus === "success" && sessionId) {
        verifyAndLoad(sessionId);
      } else if (paymentStatus === "cancelled") {
        toast.error("Payment was cancelled.");
        setSearchParams({});
        loadBook();
      } else {
        loadBook();
      }
    }
  }, [bookId]);

  const verifyAndLoad = async (sessionId: string) => {
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId },
      });

      if (error) throw error;

      if (data?.success) {
        setShowSuccessModal(true);
      } else {
        toast.error("Payment not confirmed yet. Please try refreshing.");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      toast.error("Could not verify payment. Please refresh the page.");
    } finally {
      setSearchParams({});
      setIsVerifying(false);
      await loadBook();
    }
  };

  const loadBook = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .single();

      if (bookError) throw bookError;
      setBook(bookData);

      // Load seller name
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", bookData.author_id)
        .single();
      if (sellerProfile) setSellerName(sellerProfile.name);

      // Load product images
      const { data: images } = await supabase
        .from("product_images")
        .select("image_url")
        .eq("book_id", bookId!)
        .order("display_order");
      if (images) setProductImages(images.map((i: any) => i.image_url));

      let hasAccess = false;
      if (user) {
        const isAuthor = bookData.author_id === user.id;
        if (isAuthor || bookData.is_free) {
          hasAccess = true;
        } else {
          const { data: purchase } = await supabase
            .from("book_purchases")
            .select("*")
            .eq("book_id", bookId!)
            .eq("buyer_id", user.id)
            .eq("payment_status", "completed")
            .maybeSingle();
          if (purchase) {
            hasAccess = true;
            setPurchaseRecord(purchase);
          }
        }
        setHasPurchased(hasAccess);

        if (hasAccess && bookData.pdf_url) {
          await loadContentUrl(bookData);
        }
      } else {
        if (bookData.is_free && bookData.pdf_url) {
          await loadContentUrl(bookData);
          setHasPurchased(true);
        }
      }

      // For paid books without access, load preview URL
      if (!hasAccess && !bookData.is_free && bookData.pdf_url && !bookData.requires_delivery) {
        await loadContentUrl(bookData, true);
      }
    } catch (error: any) {
      console.error("Error loading book:", error);
      toast.error("Failed to load book");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContentUrl = async (bookData: any, _previewOnly = false) => {
    if (bookData.product_type === "video") {
      const { data: { publicUrl } } = supabase.storage
        .from("book-videos")
        .getPublicUrl(bookData.pdf_url);
      setPdfUrl(publicUrl);
    } else {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("book-pdfs")
        .createSignedUrl(bookData.pdf_url, 3600);
      if (!signedError && signedData?.signedUrl) {
        setPdfUrl(signedData.signedUrl);
      }
    }
  };

  const handlePurchaseClick = () => {
    if (book.requires_delivery) {
      setShowDeliveryDialog(true);
    } else {
      handlePurchase();
    }
  };

  const handlePurchase = async (deliveryData?: typeof deliveryInfo) => {
    setIsPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to purchase");
        navigate("/auth");
        return;
      }

      const { data: sessionData, error } = await supabase.functions.invoke("create-checkout", {
        body: { bookId, deliveryInfo: deliveryData },
      });

      if (error) throw error;
      if (sessionData?.url) window.open(sessionData.url, "_blank");
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast.error(error.message || "Failed to create checkout");
    } finally {
      setIsPurchasing(false);
      setShowDeliveryDialog(false);
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handlePurchase(deliveryInfo);
  };

  const handleDownload = async () => {
    if (!book || !pdfUrl) return;
    try {
      await supabase.rpc("increment_book_downloads", { book_id: bookId });
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `${book.title}.${book.product_type === "video" ? "mp4" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started!");
    } catch (error: any) {
      console.error("Error downloading:", error);
      toast.error("Failed to download");
    }
  };

  const isPhysicalProduct = book?.requires_delivery;
  const isDigitalContent = !isPhysicalProduct && book;

  if (isLoading || isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isVerifying ? "Verifying your payment..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Product not found</p>
          <Button onClick={() => navigate("/marketplace")} className="mt-4">Back to Marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/marketplace")} className="hover:bg-primary/5">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate("/my-orders")} className="gap-2 text-sm">
            <Package className="w-4 h-4" />
            My Orders
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Media */}
          <div className="lg:col-span-2">
            {isPhysicalProduct ? (
              <ImageGallery
                images={productImages}
                coverImage={book.cover_image_url}
                title={book.title}
              />
            ) : (
              <Card className="overflow-hidden rounded-2xl border-0 shadow-lg">
                <div className="aspect-[3/4] relative bg-muted">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <div className="text-7xl opacity-30">📚</div>
                    </div>
                  )}
                  {book.is_free && (
                    <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground font-bold text-xs px-3 py-1">
                      FREE
                    </Badge>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Title & badges */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary" className="text-xs">{book.category}</Badge>
                <Badge variant="outline" className="text-xs">{book.product_type === "book" ? "📖 Book" : book.product_type === "video" ? "🎬 Video" : "📄 Material"}</Badge>
                {book.book_type && <Badge variant="outline" className="text-xs">{book.book_type}</Badge>}
                {isPhysicalProduct && <Badge className="bg-accent/20 text-accent border-accent/30 text-xs"><Package className="w-3 h-3 mr-1" /> Physical Item</Badge>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{book.title}</h1>
              <p className="text-muted-foreground mt-2">by <span className="text-primary font-medium">{sellerName}</span></p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {book.views_count} views</span>
              <span className="flex items-center gap-1"><Download className="w-4 h-4" /> {book.downloads_count} downloads</span>
            </div>

            {/* Pricing */}
            <Card className="p-5 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Price</p>
                  <p className="text-3xl font-bold text-primary">
                    {book.is_free ? "Free" : `₦${book.price.toLocaleString()}`}
                  </p>
                  {book.requires_delivery && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Truck className="h-3 w-3" /> + ₦{book.delivery_fee?.toLocaleString()} delivery
                    </p>
                  )}
                </div>
                {book.stock_quantity != null && book.requires_delivery && (
                  <p className="text-sm text-muted-foreground">
                    {book.stock_quantity > 0 ? `${book.stock_quantity} in stock` : "Out of stock"}
                  </p>
                )}
              </div>

              <Separator className="my-4" />

              {hasPurchased || book.is_free ? (
                isPhysicalProduct ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-emerald-600">
                      <Star className="w-5 h-5" />
                      <span className="font-medium">Order placed successfully! The seller has been notified.</span>
                    </div>
                    {purchaseRecord?.delivery_status && (
                      <Badge variant="outline" className="text-xs">
                        Delivery: {purchaseRecord.delivery_status}
                      </Badge>
                    )}
                    <Button variant="outline" onClick={() => navigate("/my-orders")} className="w-full rounded-xl gap-2 mt-2">
                      <Package className="w-4 h-4" />
                      View My Orders
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button onClick={handleDownload} className="w-full rounded-xl" size="lg">
                      <Download className="mr-2 h-5 w-5" />
                      Download {book.product_type === "video" ? "Video" : "PDF"}
                    </Button>
                    <Button variant="ghost" onClick={() => navigate("/my-orders")} className="w-full rounded-xl text-sm gap-2">
                      <Package className="w-4 h-4" />
                      View My Orders
                    </Button>
                  </div>
                )
              ) : (
                <Button
                  onClick={handlePurchaseClick}
                  disabled={isPurchasing || (book.requires_delivery && book.stock_quantity <= 0)}
                  className="w-full rounded-xl"
                  size="lg"
                >
                  {isPurchasing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {book.requires_delivery ? "Order Now" : "Buy Now"} — ₦{book.price.toLocaleString()}
                    </>
                  )}
                </Button>
              )}
            </Card>

            {/* Description */}
            {book.description && (
              <Card className="p-5 rounded-xl">
                <h2 className="text-lg font-semibold mb-3 text-foreground">About this {isPhysicalProduct ? "product" : "book"}</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{book.description}</p>
              </Card>
            )}

            {/* Preview Video */}
            {book.video_url && (
              <Card className="p-5 rounded-xl">
                <h2 className="text-lg font-semibold mb-3 text-foreground">Preview Video</h2>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <video controls className="w-full h-full">
                    <source src={book.video_url} type="video/mp4" />
                  </video>
                </div>
              </Card>
            )}

            {/* Content Preview / Full Access */}
            {isDigitalContent && pdfUrl && (
              <Card className="p-5 rounded-xl">
                {hasPurchased || book.is_free ? (
                  <>
                    <h2 className="text-lg font-semibold mb-3 text-foreground">
                      {book.product_type === "video" ? "Watch Online" : "Read Online"}
                    </h2>
                    <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden">
                      {book.product_type === "video" ? (
                        <video controls className="w-full h-full">
                          <source src={pdfUrl} type="video/mp4" />
                        </video>
                      ) : (
                        <iframe src={pdfUrl} className="w-full h-full" title="Book Content" />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold text-foreground">Preview</h2>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Lock className="w-3 h-3" /> Pages 1–2 only
                      </Badge>
                    </div>
                    <div className="relative aspect-[16/10] bg-muted rounded-lg overflow-hidden">
                      {book.product_type === "video" ? (
                        <video controls className="w-full h-full" controlsList="nodownload">
                          <source src={pdfUrl} type="video/mp4" />
                        </video>
                      ) : (
                        <iframe
                          src={`${pdfUrl}#page=1`}
                          className="w-full h-full"
                          title="Book Preview"
                        />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-4">
                        <Button onClick={handlePurchaseClick} className="rounded-xl gap-2 shadow-lg">
                          <Lock className="w-4 h-4" />
                          Purchase to unlock full content
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <PurchaseSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        book={book}
        onDownload={handleDownload}
      />

      {/* Delivery Dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Delivery Information</DialogTitle>
            <DialogDescription>Enter your delivery details to complete this order</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeliverySubmit} className="space-y-4">
            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" value={deliveryInfo.address} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })} required placeholder="123 Main Street" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={deliveryInfo.city} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={deliveryInfo.state} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, state: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={deliveryInfo.phone} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })} required placeholder="+234..." />
            </div>
            <Card className="p-4 bg-muted/50 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Product</span>
                <span>₦{book?.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Delivery</span>
                <span>₦{book?.delivery_fee?.toLocaleString()}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">₦{((book?.price || 0) + (book?.delivery_fee || 0)).toLocaleString()}</span>
              </div>
            </Card>
            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={isPurchasing}>
              {isPurchasing ? "Processing..." : "Proceed to Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Buyer-Seller Chat (only after purchase) */}
      {hasPurchased && purchaseRecord && currentUserId && currentUserId !== book.author_id && (
        <OrderChat
          purchaseId={purchaseRecord.id}
          currentUserId={currentUserId}
          otherUserName={sellerName}
        />
      )}
    </div>
  );
}
