import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Eye, Trash2, UserX, Crown, MoreHorizontal,
  ChevronLeft, ChevronRight, Download, Filter, Shield
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface UserManagementProps {
  profiles: any[];
  onRefresh: () => void;
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function UserManagement({ profiles, onRefresh, onLogActivity }: UserManagementProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const perPage = 20;

  const filtered = profiles.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "premium" && p.is_premium)
      || (statusFilter === "free" && !p.is_premium);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSelectAll = () => {
    if (selectedUsers.size === paginated.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginated.map(p => p.id)));
    }
  };

  const toggleUser = (id: string) => {
    const next = new Set(selectedUsers);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedUsers(next);
  };

  const handleDeleteUser = async (profile: any) => {
    try {
      // Delete profile (cascade will handle related data)
      const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
      if (error) throw error;
      onLogActivity("Deleted user", "user", profile.id, `Deleted user: ${profile.name}`);
      toast.success(`User "${profile.name}" deleted`);
      setDeleteDialog(null);
      onRefresh();
    } catch {
      toast.error("Failed to delete user. Users may need to be removed via authentication settings.");
    }
  };

  const handleTogglePremium = async (profile: any) => {
    try {
      const { error } = await supabase.from("profiles").update({ is_premium: !profile.is_premium }).eq("id", profile.id);
      if (error) throw error;
      const action = profile.is_premium ? "Removed premium from" : "Upgraded to premium";
      onLogActivity(`${action} user`, "user", profile.id, `${action}: ${profile.name}`);
      toast.success(`${profile.name} ${profile.is_premium ? "downgraded" : "upgraded"} successfully`);
      onRefresh();
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    try {
      for (const id of selectedUsers) {
        await supabase.from("profiles").delete().eq("id", id);
      }
      onLogActivity("Bulk deleted users", "user", "", `Deleted ${selectedUsers.size} users`);
      toast.success(`${selectedUsers.size} users deleted`);
      setSelectedUsers(new Set());
      onRefresh();
    } catch {
      toast.error("Failed to delete some users");
    }
  };

  const exportCSV = () => {
    const csv = ["Name,Status,Rank,Joined", ...filtered.map(p =>
      `"${p.name}",${p.is_premium ? "Premium" : "Free"},${p.rank},${new Date(p.created_at).toLocaleDateString()}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} total users</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name..." className="pl-10 h-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="free">Free</SelectItem>
          </SelectContent>
        </Select>
        {selectedUsers.size > 0 && (
          <Button variant="destructive" size="sm" className="gap-1 text-xs" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedUsers.size} selected
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" className="rounded" checked={selectedUsers.size === paginated.length && paginated.length > 0} onChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Followers</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((p) => (
              <TableRow key={p.id} className="group">
                <TableCell>
                  <input type="checkbox" className="rounded" checked={selectedUsers.has(p.id)} onChange={() => toggleUser(p.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {p.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {p.is_premium
                    ? <Badge className="bg-accent/20 text-accent text-[10px] border-0">Premium</Badge>
                    : <Badge variant="outline" className="text-[10px]">Free</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">#{p.rank}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.followers_count || 0}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => navigate(`/profile/${p.id}`)}>
                        <Eye className="w-4 h-4 mr-2" /> View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTogglePremium(p)}>
                        <Crown className="w-4 h-4 mr-2" /> {p.is_premium ? "Remove Premium" : "Upgrade to Premium"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialog(p)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No users found</p>}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteDialog?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDeleteUser(deleteDialog)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
