import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Trash2, Eye, MoreHorizontal, BookOpen, Video,
  Briefcase, Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ContentManagementProps {
  books: any[];
  reels: any[];
  opportunities: any[];
  onRefresh: () => void;
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function ContentManagement({ books, reels, opportunities, onRefresh, onLogActivity }: ContentManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; item: any } | null>(null);
  const [priceFilter, setPriceFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const handleDelete = async () => {
    if (!deleteDialog) return;
    const { type, item } = deleteDialog;
    try {
      const { error } = await supabase.from(type === "book" ? "books" : type === "reel" ? "reels" : "opportunities").delete().eq("id", item.id);
      if (error) throw error;
      onLogActivity(`Deleted ${type}`, type, item.id, `Deleted: ${item.title || "Untitled"}`);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
      setDeleteDialog(null);
      onRefresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleApproveBook = async (book: any) => {
    try {
      const { error } = await supabase.from("books").update({ is_approved: true }).eq("id", book.id);
      if (error) throw error;
      onLogActivity("Approved book", "book", book.id, `Approved: ${book.title}`);
      toast.success(`"${book.title}" approved and now live on marketplace`);
      onRefresh();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleRejectBook = async (book: any) => {
    try {
      const { error } = await supabase.from("books").update({ is_approved: false }).eq("id", book.id);
      if (error) throw error;
      onLogActivity("Rejected book", "book", book.id, `Rejected: ${book.title}`);
      toast.success(`"${book.title}" has been rejected`);
      onRefresh();
    } catch {
      toast.error("Failed to reject");
    }
  };

  const pendingBooks = books.filter(b => !b.is_approved);
  const approvedBooks = books.filter(b => b.is_approved);

  const filteredBooks = books.filter(b => {
    const matchSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPrice = priceFilter === "all" || (priceFilter === "free" && b.is_free) || (priceFilter === "paid" && !b.is_free);
    const matchApproval = approvalFilter === "all" || (approvalFilter === "pending" && !b.is_approved) || (approvalFilter === "approved" && b.is_approved);
    return matchSearch && matchPrice && matchApproval;
  });

  const filteredReels = reels.filter(r => (r.title || "").toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredOpps = opportunities.filter(o => o.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  const paginate = (arr: any[]) => {
    const totalPages = Math.ceil(arr.length / perPage);
    return { items: arr.slice((page - 1) * perPage, page * perPage), totalPages, total: arr.length };
  };

  const Pagination = ({ total, totalPages }: { total: number; totalPages: number }) => totalPages > 1 ? (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-xs text-muted-foreground">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">{page}/{totalPages}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Management</h1>
          <p className="text-sm text-muted-foreground">{books.length} books · {reels.length} reels · {opportunities.length} opportunities</p>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {pendingBooks.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{pendingBooks.length} product{pendingBooks.length > 1 ? "s" : ""} awaiting approval</p>
                <p className="text-xs text-muted-foreground">Review and approve new seller uploads before they go live</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setApprovalFilter("pending"); setPage(1); }}>
              View Pending
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search content..." className="pl-10 h-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
        </div>
        <Select value={priceFilter} onValueChange={(v) => { setPriceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-28 h-9 text-xs">
            <Filter className="w-3.5 h-3.5 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Prices</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={approvalFilter} onValueChange={(v) => { setApprovalFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="books" onValueChange={() => setPage(1)}>
        <TabsList>
          <TabsTrigger value="books" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Books ({books.length})
            {pendingBooks.length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px] border-0 ml-1">{pendingBooks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5"><Video className="w-3.5 h-3.5" /> Reels ({reels.length})</TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Opportunities ({opportunities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="books">
          {(() => { const { items, totalPages, total } = paginate(filteredBooks); return (
            <Card className="bg-card border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(b => (
                    <TableRow key={b.id} className={!b.is_approved ? "bg-yellow-500/5" : ""}>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">{b.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{b.category}</Badge></TableCell>
                      <TableCell>
                        {b.is_approved ? (
                          <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Live
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px] border-0 gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs capitalize">{b.book_type}</TableCell>
                      <TableCell>{b.is_free ? <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Free</Badge> : <span className="text-sm text-foreground">₦{b.price}</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{b.views_count}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!b.is_approved && (
                            <>
                              <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveBook(b)}>
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleRejectBook(b)}>
                                <XCircle className="w-3 h-3" /> Reject
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/marketplace/book/${b.id}`, "_blank")}><Eye className="w-4 h-4 mr-2" /> View</DropdownMenuItem>
                              {b.is_approved && (
                                <DropdownMenuItem onClick={() => handleRejectBook(b)}><XCircle className="w-4 h-4 mr-2" /> Revoke Approval</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialog({ type: "book", item: b })}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length === 0 && <p className="text-center text-muted-foreground py-8">No books found</p>}
              <Pagination total={total} totalPages={totalPages} />
            </Card>
          ); })()}
        </TabsContent>

        <TabsContent value="reels">
          {(() => { const { items, totalPages, total } = paginate(filteredReels); return (
            <Card className="bg-card border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Likes</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">{r.title || "Untitled"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.views_count}</TableCell>
                      <TableCell className="text-muted-foreground">{r.likes_count}</TableCell>
                      <TableCell className="text-muted-foreground">{r.comments_count}</TableCell>
                      <TableCell className="text-muted-foreground">{r.shares_count}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "reel", item: r })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length === 0 && <p className="text-center text-muted-foreground py-8">No reels found</p>}
              <Pagination total={total} totalPages={totalPages} />
            </Card>
          ); })()}
        </TabsContent>

        <TabsContent value="opportunities">
          {(() => { const { items, totalPages, total } = paginate(filteredOpps); return (
            <Card className="bg-card border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">{o.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{o.category}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{o.organization || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{o.applications_count}</TableCell>
                      <TableCell className="text-muted-foreground">{o.views_count}</TableCell>
                      <TableCell>
                        {o.is_active ? <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Active</Badge> : <Badge className="bg-muted text-muted-foreground text-[10px] border-0">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "opportunity", item: o })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length === 0 && <p className="text-center text-muted-foreground py-8">No opportunities found</p>}
              <Pagination total={total} totalPages={totalPages} />
            </Card>
          ); })()}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleteDialog?.type}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">"{deleteDialog?.item?.title || "Untitled"}"</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
