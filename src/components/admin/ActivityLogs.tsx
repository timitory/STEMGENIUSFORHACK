import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

interface ActivityLogsProps {
  profiles: any[];
}

export function ActivityLogs({ profiles }: ActivityLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 25;

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  const loadLogs = async () => {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs(data || []);
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profileMap[l.admin_id]?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const targetColor = (t: string) => {
    switch (t) {
      case "user": return "bg-primary/20 text-primary";
      case "book": case "reel": case "opportunity": return "bg-chart-3/20 text-chart-3";
      case "feedback": return "bg-orange-500/20 text-orange-400";
      case "admin": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">Track all admin actions on the platform</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search logs..." className="pl-10 h-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
      </div>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Date & Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(l => (
              <TableRow key={l.id}>
                <TableCell>
                  <span className="font-medium text-foreground text-sm">{profileMap[l.admin_id]?.name || "Admin"}</span>
                </TableCell>
                <TableCell className="text-foreground text-sm">{l.action}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] capitalize border-0 ${targetColor(l.target_type)}`}>{l.target_type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[250px] truncate">{l.details || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ScrollText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No activity logs yet</p>
          </div>
        )}
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
    </div>
  );
}
