import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, ShoppingCart, Trash2, Plus, Minus, Book, Video, 
  FileText, CreditCard, Gift, Truck, ShoppingBag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyPurchase } from "@/lib/notifications";

interface CartItem {
  id: string;
  title: string;
  type: "book" | "video" | "material";
  price: number;
  quantity: number;
  coverImage?: string;
  requiresDelivery?: boolean;
  deliveryFee?: number;
}

export default function Cart() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    loadCartFromStorage();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem("stemgenius_cart");
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    } else {
      // Sample items for demonstration
      const sampleItems: CartItem[] = [
        {
          id: "1",
          title: "Advanced Physics Textbook",
          type: "book",
          price: 25.99,
          quantity: 1,
          coverImage: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=200&h=300&fit=crop",
          requiresDelivery: true,
          deliveryFee: 5.00
        },
        {
          id: "2",
          title: "Chemistry Lab Tutorials",
          type: "video",
          price: 15.99,
          quantity: 1,
          coverImage: "https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=200&h=300&fit=crop",
          requiresDelivery: false
        }
      ];
      setCartItems(sampleItems);
      localStorage.setItem("stemgenius_cart", JSON.stringify(sampleItems));
    }
  };

  const saveCart = (items: CartItem[]) => {
    localStorage.setItem("stemgenius_cart", JSON.stringify(items));
    setCartItems(items);
  };

  const updateQuantity = (id: string, delta: number) => {
    const updatedItems = cartItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    saveCart(updatedItems);
  };

  const removeItem = (id: string) => {
    const updatedItems = cartItems.filter(item => item.id !== id);
    saveCart(updatedItems);
    toast.success("Item removed from cart");
  };

  const clearCart = () => {
    saveCart([]);
    toast.success("Cart cleared");
  };

  const applyPromoCode = () => {
    if (promoCode.toUpperCase() === "STEM20") {
      setDiscount(20);
      toast.success("Promo code applied! 20% discount");
    } else if (promoCode.toUpperCase() === "FIRST10") {
      setDiscount(10);
      toast.success("Promo code applied! 10% discount");
    } else {
      toast.error("Invalid promo code");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "book": return <Book className="w-5 h-5" />;
      case "video": return <Video className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryTotal = cartItems.reduce((sum, item) => sum + (item.requiresDelivery ? (item.deliveryFee || 0) * item.quantity : 0), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount + deliveryTotal;

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsLoading(true);
    try {
      // Simulate checkout process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create notifications for each purchased item
      for (const item of cartItems) {
        await notifyPurchase(user.id, item.title, item.type, item.price);
      }

      toast.success("Order placed successfully!");
      clearCart();
      navigate("/marketplace");
    } catch (error) {
      toast.error("Checkout failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Shopping Cart
              </h1>
              <p className="text-sm text-muted-foreground">{cartItems.length} items in your cart</p>
            </div>
          </div>
          {cartItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearCart}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cart
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {cartItems.length === 0 ? (
            <Card className="p-12 text-center">
              <ShoppingBag className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
              <h3 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-6">Browse our marketplace to find great educational content</p>
              <Button onClick={() => navigate("/marketplace")}>
                <Book className="w-4 h-4 mr-2" />
                Browse Marketplace
              </Button>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-32 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                        {item.coverImage ? (
                          <img 
                            src={item.coverImage} 
                            alt={item.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {getIcon(item.type)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{item.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                              {item.requiresDelivery && (
                                <Badge variant="secondary" className="text-xs">
                                  <Truck className="w-3 h-3 mr-1" />
                                  Physical
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-primary">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                            {item.requiresDelivery && (
                              <p className="text-xs text-muted-foreground">
                                +${((item.deliveryFee || 0) * item.quantity).toFixed(2)} delivery
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="p-6 sticky top-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Order Summary</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">${subtotal.toFixed(2)}</span>
                    </div>
                    {deliveryTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Truck className="w-4 h-4" />
                          Delivery
                        </span>
                        <span className="text-foreground">${deliveryTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-500">
                        <span className="flex items-center gap-1">
                          <Gift className="w-4 h-4" />
                          Discount ({discount}%)
                        </span>
                        <span>-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Promo Code */}
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                    />
                    <Button variant="outline" onClick={applyPromoCode}>
                      Apply
                    </Button>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between text-lg font-bold mb-6">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      "Processing..."
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Checkout
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Secure checkout powered by Stripe
                  </p>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
