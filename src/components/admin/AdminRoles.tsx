import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, UserPlus, Trash2, Search, Crown } from "lucide-react";
import { toast } from "sonner";

interface AdminRolesProps {
  profiles: any[];
  onRefresh: () => void;
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function AdminRoles({ profiles, onRefresh, onLogActivity }: AdminRolesProps) {
  const [roles, setRoles] = useState<any[]>([]);
  const [addDialog, setAddDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("moderator");
  const [searchQuery, setSearchQuery] = useState("");

  const loadRoles = async () => {
    const { data } = await supabase.from("user_roles").select("*");
    setRoles(data || []);
  };

  useEffect(() => { loadRoles(); }, []);

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  const adminRoles = roles.filter(r => r.role === "admin" || r.role === "moderator");

  const handleAddRole = async () => {
    if (!selectedUserId || !selectedRole) return;
    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUserId,
        role: selectedRole as any,
      });
      if (error) throw error;
      const profile = profileMap[selectedUserId];
      onLogActivity("Added admin role", "admin", selectedUserId, `Assigned ${selectedRole} to ${profile?.name || "user"}`);
      toast.success("Role assigned");
      setAddDialog(false);
      setSelectedUserId("");
      loadRoles();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "User already has this role" : "Failed to assign role");
    }
  };

  const handleRemoveRole = async (roleEntry: any) => {
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleEntry.id);
      if (error) throw error;
      const profile = profileMap[roleEntry.user_id];
      onLogActivity("Removed admin role", "admin", roleEntry.user_id, `Removed ${roleEntry.role} from ${profile?.name || "user"}`);
      toast.success("Role removed");
      loadRoles();
      onRefresh();
    } catch { toast.error("Failed to remove role"); }
  };

  const filteredProfiles = profiles.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleColor = (r: string) => {
    switch (r) {
      case "admin": return "bg-destructive/20 text-destructive";
      case "moderator": return "bg-accent/20 text-accent";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin & Role Management</h1>
          <p className="text-sm text-muted-foreground">Manage admin roles and permissions</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setAddDialog(true)}>
          <UserPlus className="w-4 h-4" /> Add Admin
        </Button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-destructive" />
            <div><p className="text-xl font-bold text-foreground">{roles.filter(r => r.role === "admin").length}</p><p className="text-xs text-muted-foreground">Super Admins</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Crown className="w-5 h-5 text-accent" />
            <div><p className="text-xl font-bold text-foreground">{roles.filter(r => r.role === "moderator").length}</p><p className="text-xs text-muted-foreground">Moderators</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            <div><p className="text-xl font-bold text-foreground">{roles.filter(r => r.role === "user").length}</p><p className="text-xs text-muted-foreground">Regular Users</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Admins table */}
      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminRoles.map(r => {
              const profile = profileMap[r.user_id];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {profile?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="font-medium text-foreground">{profile?.name || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={`text-[10px] capitalize border-0 ${roleColor(r.role)}`}>{r.role}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemoveRole(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {adminRoles.length === 0 && <p className="text-center text-muted-foreground py-8">No admin roles assigned</p>}
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Admin Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {filteredProfiles.slice(0, 20).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedUserId(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedUserId === p.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {p.name?.charAt(0)?.toUpperCase()}
                  </div>
                  {p.name}
                </button>
              ))}
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={!selectedUserId}>Assign Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
