import { useState, useEffect } from "react";
import heroMarketplaceImg from "@/assets/hero-marketplace.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Search, Filter, Upload, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFeatureAuth } from "@/hooks/useFeatureAuth";

interface Book {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  price: number;
  is_free: boolean;
  category: string;
  downloads_count: number;
  views_count: number;
  author_id: string;
}

export default function STEMMarketplace() {
  const navigate = useNavigate();
  const { user, isPreviewAvailable } = useFeatureAuth("marketplace");
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = ["all", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Engineering", "General"];
  const productTypes = ["all", "book", "video", "academic_material"];
  const [selectedProductType, setSelectedProductType] = useState("all");

  useEffect(() => {
    loadBooks();
  }, [selectedCategory]);

  const loadBooks = async () => {
    try {
      let query = supabase
        .from("books")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }

      if (selectedProductType !== "all") {
        query = query.eq("product_type", selectedProductType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBooks(data || []);
    } catch (error: any) {
      console.error("Error loading books:", error);
      toast.error("Failed to load books");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBookClick = async (bookId: string) => {
    if (user) {
      await supabase.rpc("increment_book_views", { book_id: bookId });
    }
    navigate(`/marketplace/book/${bookId}`);
  };

  const handlePublishClick = () => {
    if (!user) {
      navigate("/auth?mode=signup");
      return;
    }
    navigate("/marketplace/publish");
  };

  const handleDashboardClick = () => {
    if (!user) {
      navigate("/auth?mode=login");
      return;
    }
    navigate("/marketplace/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handlePublishClick}
            >
              <Upload className="mr-2 h-4 w-4" />
              Publish Book
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleDashboardClick}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              My Dashboard
            </Button>
          </div>
        </div>

        <PageHeroBanner image={heroMarketplaceImg} title="STEM Marketplace" subtitle="Discover and share educational content, books, and materials" badge="Marketplace" />

        {!user && isPreviewAvailable && (
          <div className="mt-6">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                You're browsing the marketplace as a preview. Log in to purchase content and publish your own materials.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="mt-6">

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedProductType} onValueChange={setSelectedProductType}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All Types" : type.replace("_", " ").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading books...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">No books found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((book) => (
              <Card
                key={book.id}
                className="overflow-hidden hover:border-primary transition-all cursor-pointer group"
                onClick={() => handleBookClick(book.id)}
              >
                <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                  {book.cover_image_url ? (
                    <img
                      src={book.cover_image_url}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-muted-foreground opacity-20" />
                    </div>
                  )}
                  {book.is_free && (
                    <Badge className="absolute top-2 right-2" variant="secondary">
                      Free
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{book.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {book.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{book.category}</Badge>
                    <p className="font-bold text-primary">
                      {book.is_free ? "Free" : `₦${book.price.toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{book.views_count} views</span>
                    <span>{book.downloads_count} downloads</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}