import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Send, Trash2, Filter, Eye, ChevronLeft, ChevronRight,
  CheckCircle, Clock, XCircle, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

interface FeedbackManagementProps {
  feedbacks: any[];
  onRefresh: () => void;
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function FeedbackManagement({ feedbacks, onRefresh, onLogActivity }: FeedbackManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [respondDialog, setRespondDialog] = useState<any>(null);
  const [viewDialog, setViewDialog] = useState<any>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const pending = feedbacks.filter(f => f.status === "pending").length;
  const responded = feedbacks.filter(f => f.status === "responded").length;
  const resolved = feedbacks.filter(f => f.status === "resolved").length;

  const filtered = feedbacks.filter(f => {
    const matchSearch = f.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || f.message?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    const matchCategory = categoryFilter === "all" || f.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleRespond = async () => {
    if (!respondDialog || !adminResponse.trim()) return;
    try {
      const { error } = await supabase.from("feedback").update({
        admin_response: adminResponse.trim(),
        status: "responded",
        responded_at: new Date().toISOString(),
      }).eq("id", respondDialog.id);
      if (error) throw error;
      onLogActivity("Responded to feedback", "feedback", respondDialog.id, `Re: ${respondDialog.subject}`);
      toast.success("Response sent");
      setRespondDialog(null);
      setAdminResponse("");
      onRefresh();
    } catch { toast.error("Failed to respond"); }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("feedback").delete().eq("id", id);
      if (error) throw error;
      onLogActivity("Deleted feedback", "feedback", id, "");
      toast.success("Feedback deleted");
      onRefresh();
    } catch { toast.error("Failed to delete"); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status updated");
      onRefresh();
    } catch { toast.error("Failed to update"); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "responded": return "bg-green-500/20 text-green-400";
      case "resolved": return "bg-primary/20 text-primary";
      case "dismissed": return "bg-muted text-muted-foreground";
      default: return "";
    }
  };

  const categoryColor = (c: string) => {
    switch (c) {
      case "bug": return "bg-destructive/20 text-destructive";
      case "feature": return "bg-primary/20 text-primary";
      case "complaint": return "bg-orange-500/20 text-orange-400";
      case "praise": return "bg-green-500/20 text-green-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Feedback Management</h1>
        <p className="text-sm text-muted-foreground">{feedbacks.length} total feedback items</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div><p className="text-xl font-bold text-foreground">{pending}</p><p className="text-xs text-muted-foreground">Pending</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-green-400" />
            <div><p className="text-xl font-bold text-foreground">{responded}</p><p className="text-xs text-muted-foreground">Responded</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-primary" />
            <div><p className="text-xl font-bold text-foreground">{resolved}</p><p className="text-xs text-muted-foreground">Resolved</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search feedback..." className="pl-10 h-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="responded">Responded</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(f => (
              <TableRow key={f.id}>
                <TableCell><Badge className={`text-[10px] capitalize border-0 ${categoryColor(f.category)}`}>{f.category}</Badge></TableCell>
                <TableCell className="font-medium text-foreground max-w-[150px] truncate">{f.subject}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">{f.message}</TableCell>
                <TableCell>
                  <Select value={f.status} onValueChange={(v) => handleStatusChange(f.id, v)}>
                    <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="responded">Responded</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDialog(f)}><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRespondDialog(f); setAdminResponse(f.admin_response || ""); }}><Send className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No feedback found</p>}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-muted-foreground px-2">{page}/{totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Feedback Details</DialogTitle></DialogHeader>
          {viewDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs capitalize border-0 ${categoryColor(viewDialog.category)}`}>{viewDialog.category}</Badge>
                <Badge className={`text-xs capitalize border-0 ${statusColor(viewDialog.status)}`}>{viewDialog.status}</Badge>
              </div>
              <div><p className="text-xs text-muted-foreground">Subject</p><p className="text-sm font-medium text-foreground">{viewDialog.subject}</p></div>
              <div><p className="text-xs text-muted-foreground">Message</p><p className="text-sm text-foreground">{viewDialog.message}</p></div>
              {viewDialog.admin_response && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Admin Response</p>
                  <p className="text-sm text-foreground">{viewDialog.admin_response}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Submitted: {new Date(viewDialog.created_at).toLocaleString()}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Respond Dialog */}
      <Dialog open={!!respondDialog} onOpenChange={() => setRespondDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Respond to Feedback</DialogTitle></DialogHeader>
          {respondDialog && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{respondDialog.subject}</p>
                <p className="text-sm text-muted-foreground mt-1">{respondDialog.message}</p>
              </div>
              <Textarea placeholder="Write your response..." value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} rows={4} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialog(null)}>Cancel</Button>
            <Button onClick={handleRespond} disabled={!adminResponse.trim()}>Send Response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
