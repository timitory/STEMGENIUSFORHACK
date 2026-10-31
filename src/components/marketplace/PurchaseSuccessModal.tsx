import { CheckCircle2, Download, Package, MessageCircle, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface PurchaseSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: {
    title: string;
    price: number;
    requires_delivery: boolean;
    delivery_fee?: number;
    product_type: string;
  } | null;
  onDownload?: () => void;
}

export function PurchaseSuccessModal({ open, onOpenChange, book, onDownload }: PurchaseSuccessModalProps) {
  const navigate = useNavigate();

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md text-center p-0 overflow-hidden">
        {/* Success header */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-primary/5 to-accent/10 p-8">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Payment Successful! 🎉</h2>
          <p className="text-muted-foreground mt-2 text-sm">Your order has been confirmed</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Order summary */}
          <div className="bg-muted/50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-foreground">{book.title}</p>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span>₦{book.price.toLocaleString()}</span>
            </div>
            {book.requires_delivery && book.delivery_fee && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Delivery</span>
                <span>₦{book.delivery_fee.toLocaleString()}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">
                ₦{((book.price || 0) + (book.requires_delivery ? book.delivery_fee || 0 : 0)).toLocaleString()}
              </span>
            </div>
          </div>

          {/* What's next */}
          <div className="text-left space-y-3">
            <p className="text-sm font-semibold text-foreground">What's next?</p>
            {book.requires_delivery ? (
              <>
                <div className="flex items-start gap-3 text-sm">
                  <Package className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">The seller has been notified and will process your order shortly.</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MessageCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">You can now chat with the seller about your order details.</span>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 text-sm">
                <Download className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  Your {book.product_type === "video" ? "video" : "PDF"} is now unlocked. You can download or view it anytime.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {!book.requires_delivery && onDownload && (
              <Button onClick={onDownload} className="w-full rounded-xl gap-2">
                <Download className="w-4 h-4" />
                Download Now
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); navigate("/my-orders"); }}
              className="w-full rounded-xl gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              View My Orders
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl text-sm"
            >
              Continue Browsing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
