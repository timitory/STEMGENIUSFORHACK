import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Download, CreditCard, TrendingUp, DollarSign,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface PaymentManagementProps {
  purchases: any[];
  books: any[];
  profiles: any[];
}

export function PaymentManagement({ purchases, books, profiles }: PaymentManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const totalRevenue = purchases.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
  const completedPayments = purchases.filter(p => p.payment_status === "completed").length;

  const bookMap = useMemo(() => Object.fromEntries(books.map(b => [b.id, b])), [books]);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    purchases.forEach(p => {
      const month = new Date(p.purchased_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months[month] = (months[month] || 0) + (p.purchase_price || 0);
    });
    return Object.entries(months).slice(-12).map(([month, amount]) => ({ month, revenue: amount }));
  }, [purchases]);

  const filtered = purchases.filter(p => {
    const book = bookMap[p.book_id];
    const profile = profileMap[p.buyer_id];
    return (book?.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      || (profile?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const exportCSV = () => {
    const csv = ["User,Content,Amount,Status,Date", ...filtered.map(p => {
      const book = bookMap[p.book_id];
      const profile = profileMap[p.buyer_id];
      return `"${profile?.name || "Unknown"}","${book?.title || "Unknown"}",${p.purchase_price},${p.payment_status},${new Date(p.purchased_at).toLocaleDateString()}`;
    })].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500/20 text-green-400";
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "failed": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments & Revenue</h1>
          <p className="text-sm text-muted-foreground">{purchases.length} total transactions</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">₦{totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10"><CreditCard className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{purchases.length}</p><p className="text-xs text-muted-foreground">Total Transactions</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10"><TrendingUp className="w-5 h-5 text-accent" /></div>
            <div><p className="text-2xl font-bold text-foreground">{completedPayments}</p><p className="text-xs text-muted-foreground">Completed Payments</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Revenue by Month</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search transactions..." className="pl-10 h-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
      </div>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(p => {
              const book = bookMap[p.book_id];
              const profile = profileMap[p.buyer_id];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{profile?.name || "Unknown"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{book?.title || "Unknown"}</TableCell>
                  <TableCell className="font-medium text-foreground">₦{p.purchase_price?.toLocaleString()}</TableCell>
                  <TableCell><Badge className={`text-[10px] border-0 ${statusColor(p.payment_status)}`}>{p.payment_status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{p.delivery_status || "N/A"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(p.purchased_at).toLocaleDateString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No transactions found</p>}
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
