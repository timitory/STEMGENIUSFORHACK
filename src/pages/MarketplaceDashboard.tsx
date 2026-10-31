import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, DollarSign, Download, Eye, TrendingUp, Package, MessageSquare, Bell, Plus, ShoppingBag, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BookStats {
  id: string;
  title: string;
  price: number;
  is_free: boolean;
  is_approved: boolean;
  downloads_count: number;
  views_count: number;
  cover_image_url: string | null;
  category: string;
  product_type: string;
  created_at: string;
  revenue: number;
  purchases: number;
}

export default function MarketplaceDashboard() {
  const navigate = useNavigate();
  const [myBooks, setMyBooks] = useState<BookStats[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Load books, purchases, seller orders, notifications in parallel
      const [booksRes, purchasesRes, notifRes] = await Promise.all([
        supabase.from("books").select("*").eq("author_id", user.id).order("created_at", { ascending: false }),
        supabase.from("book_purchases").select(`*, books(title, cover_image_url, category, author_id)`).eq("buyer_id", user.id).order("purchased_at", { ascending: false }),
        supabase.from("seller_notifications").select(`*, book_purchases(*, books(title))`).eq("seller_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      const books = booksRes.data || [];
      
      // Get purchase stats for each book
      const booksWithStats = await Promise.all(
        books.map(async (book) => {
          const { data: purchases } = await supabase
            .from("book_purchases")
            .select("purchase_price")
            .eq("book_id", book.id)
            .eq("payment_status", "completed");
          const revenue = purchases?.reduce((sum, p) => sum + parseFloat(p.purchase_price.toString()), 0) || 0;
          return { ...book, revenue, purchases: purchases?.length || 0 };
        })
      );

      setMyBooks(booksWithStats);
      setMyPurchases(purchasesRes.data || []);
      setNotifications(notifRes.data || []);

      setTotalRevenue(booksWithStats.reduce((s, b) => s + b.revenue, 0));
      setTotalSales(booksWithStats.reduce((s, b) => s + b.purchases, 0));
      setTotalViews(booksWithStats.reduce((s, b) => s + b.views_count, 0));

      // Load seller orders (purchases of user's books)
      if (books.length > 0) {
        const bookIds = books.map(b => b.id);
        const { data: orders } = await supabase
          .from("book_purchases")
          .select(`*, books(title, requires_delivery), profiles:buyer_id(name)`)
          .in("book_id", bookIds)
          .order("purchased_at", { ascending: false });
        setSellerOrders(orders || []);
      }
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const markNotifRead = async (id: string) => {
    await supabase.from("seller_notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const statCards = [
    { label: "Products", value: myBooks.length, icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Revenue", value: `₦${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Sales", value: totalSales, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-accent", bg: "bg-accent/10" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Seller Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage products, orders & analytics</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" className="relative w-full sm:w-auto" onClick={() => navigate("/my-orders")}>
              <ShoppingBag className="w-4 h-4 mr-1.5" /> My Purchases
            </Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => navigate("/marketplace/publish") }>
              <Plus className="w-4 h-4 mr-1.5" /> Publish
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statCards.map((s) => (
            <Card key={s.label} className="p-4 border-border/50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="products">My Products</TabsTrigger>
            <TabsTrigger value="orders">
              Orders {sellerOrders.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{sellerOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              Alerts {unreadCount > 0 && <Badge className="ml-1.5 text-xs bg-destructive">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            {myBooks.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground mb-4">No products published yet</p>
                <Button onClick={() => navigate("/marketplace/publish")}>
                  <Plus className="w-4 h-4 mr-2" /> Publish Your First Product
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {myBooks.map((book) => (
                  <Card
                    key={book.id}
                    className="p-4 border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/marketplace/book/${book.id}`)}
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        {book.cover_image_url ? (
                          <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold truncate">{book.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{book.category}</Badge>
                              <Badge variant="secondary" className="text-xs">{book.product_type.replace("_", " ")}</Badge>
                              {book.is_approved ? (
                                <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0 gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Live
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px] border-0 gap-1">
                                  <Clock className="w-3 h-3" /> Pending Review
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-green-500">₦{book.revenue.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{book.purchases} sales</p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{book.views_count}</span>
                          <span className="flex items-center gap-1"><Download className="w-3 h-3" />{book.downloads_count}</span>
                          <span>{book.is_free ? "Free" : `₦${book.price.toLocaleString()}`}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            {sellerOrders.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No orders yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sellerOrders.map((order) => (
                  <Card key={order.id} className="p-4 border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{(order.books as any)?.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Buyer: {(order.profiles as any)?.name || "Unknown"} · {new Date(order.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={order.payment_status === "completed" ? "default" : "secondary"}>
                          {order.payment_status}
                        </Badge>
                        {(order.books as any)?.requires_delivery && (
                          <Badge variant="outline">{order.delivery_status || "pending"}</Badge>
                        )}
                        <p className="font-bold text-green-500">₦{parseFloat(order.purchase_price).toLocaleString()}</p>
                      </div>
                    </div>
                    {order.delivery_address && (
                      <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                        📍 {order.delivery_address}, {order.delivery_city}, {order.delivery_state} · 📞 {order.delivery_phone}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            {notifications.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2">
                <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No notifications yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <Card
                    key={n.id}
                    className={`p-4 border-border/50 cursor-pointer transition-colors ${!n.is_read ? "bg-primary/5 border-primary/20" : ""}`}
                    onClick={() => markNotifRead(n.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!n.is_read ? "bg-primary/20" : "bg-muted"}`}>
                        <ShoppingBag className={`w-4 h-4 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          New order: {(n.book_purchases as any)?.books?.title || "Product"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
