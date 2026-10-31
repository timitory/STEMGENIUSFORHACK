import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Download, MessageCircle, Clock, CheckCircle2, Truck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  book_id: string;
  purchase_price: number;
  purchased_at: string;
  payment_status: string;
  delivery_status: string | null;
  delivery_fee: number | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_phone: string | null;
  books: {
    title: string;
    cover_image_url: string | null;
    product_type: string;
    requires_delivery: boolean;
    author_id: string;
    pdf_url: string | null;
  };
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Paid" },
  pending: { icon: <Clock className="w-4 h-4" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Pending" },
  shipped: { icon: <Truck className="w-4 h-4" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Shipped" },
  delivered: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Delivered" },
  processing: { icon: <Package className="w-4 h-4" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Processing" },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("book_purchases")
        .select("*, books!book_purchases_book_id_fkey(title, cover_image_url, product_type, requires_delivery, author_id, pdf_url)")
        .eq("buyer_id", user.id)
        .eq("payment_status", "completed")
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (error: any) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  const digitalOrders = orders.filter((o) => !o.books?.requires_delivery);
  const physicalOrders = orders.filter((o) => o.books?.requires_delivery);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });

  const getStatus = (key: string | null) => statusConfig[key || "pending"] || statusConfig.pending;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const OrderCard = ({ order }: { order: Order }) => {
    const status = getStatus(order.books?.requires_delivery ? order.delivery_status : order.payment_status);
    return (
      <Card
        className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
        onClick={() => navigate(`/marketplace/book/${order.book_id}`)}
      >
        <div className="flex gap-4">
          <div className="w-16 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
            {order.books?.cover_image_url ? (
              <img src={order.books.cover_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">
                {order.books?.requires_delivery ? "📦" : "📚"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {order.books?.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(order.purchased_at)}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-xs gap-1 ${status.color}`}>
                {status.icon} {status.label}
              </Badge>
              <span className="text-sm font-bold text-primary">
                ₦{(order.purchase_price + (order.delivery_fee || 0)).toLocaleString()}
              </span>
            </div>
            {order.books?.requires_delivery && order.delivery_city && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Truck className="w-3 h-3" /> {order.delivery_city}, {order.delivery_state}
              </p>
            )}
          </div>
          <div className="flex items-center">
            {!order.books?.requires_delivery && order.books?.pdf_url && (
              <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            {order.books?.requires_delivery && (
              <MessageCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <Button variant="ghost" onClick={() => navigate("/marketplace")} className="mb-6 hover:bg-primary/5">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary" />
            My Orders
          </h1>
          <p className="text-muted-foreground mt-1">{orders.length} total purchases</p>
        </div>

        {orders.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-4">Start exploring the marketplace to find great products!</p>
            <Button onClick={() => navigate("/marketplace")}>Browse Marketplace</Button>
          </Card>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
              <TabsTrigger value="digital">Digital ({digitalOrders.length})</TabsTrigger>
              <TabsTrigger value="physical">Physical ({physicalOrders.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {orders.map((o) => <OrderCard key={o.id} order={o} />)}
            </TabsContent>
            <TabsContent value="digital" className="space-y-3">
              {digitalOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No digital purchases yet</p>
              ) : (
                digitalOrders.map((o) => <OrderCard key={o.id} order={o} />)
              )}
            </TabsContent>
            <TabsContent value="physical" className="space-y-3">
              {physicalOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No physical orders yet</p>
              ) : (
                physicalOrders.map((o) => <OrderCard key={o.id} order={o} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
