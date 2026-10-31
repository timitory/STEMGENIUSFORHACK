import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, BookOpen, Video, Briefcase, CreditCard, TrendingUp,
  UserCheck, Crown, Download, MessageSquare
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { useState, useMemo } from "react";

interface DashboardOverviewProps {
  profiles: any[];
  books: any[];
  reels: any[];
  opportunities: any[];
  feedbacks: any[];
  purchases: any[];
}

export function DashboardOverview({ profiles, books, reels, opportunities, feedbacks, purchases }: DashboardOverviewProps) {
  const [timeFilter, setTimeFilter] = useState("all");

  const totalRevenue = purchases.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
  const premiumUsers = profiles.filter(p => p.is_premium).length;
  const pendingFeedback = feedbacks.filter(f => f.status === "pending").length;

  // User growth chart data (by month)
  const userGrowthData = useMemo(() => {
    const months: Record<string, number> = {};
    profiles.forEach(p => {
      const month = new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months[month] = (months[month] || 0) + 1;
    });
    return Object.entries(months).slice(-12).map(([month, count]) => ({ month, users: count }));
  }, [profiles]);

  // Content engagement data
  const engagementData = useMemo(() => [
    { name: "Books", value: books.reduce((s, b) => s + (b.views_count || 0), 0), fill: "hsl(var(--chart-1))" },
    { name: "Reels", value: reels.reduce((s, r) => s + (r.views_count || 0), 0), fill: "hsl(var(--chart-3))" },
    { name: "Opportunities", value: opportunities.reduce((s, o) => s + (o.views_count || 0), 0), fill: "hsl(var(--chart-2))" },
  ], [books, reels, opportunities]);

  // Revenue data by month
  const revenueData = useMemo(() => {
    const months: Record<string, number> = {};
    purchases.forEach(p => {
      const month = new Date(p.purchased_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months[month] = (months[month] || 0) + (p.purchase_price || 0);
    });
    return Object.entries(months).slice(-12).map(([month, amount]) => ({ month, revenue: amount }));
  }, [purchases]);

  // Top performing content
  const topBooks = [...books].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);
  const topReels = [...reels].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);
  const mostActiveUsers = [...profiles].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 5);

  const statCards = [
    { label: "Total Users", value: profiles.length, icon: Users, change: "+12%", color: "text-primary" },
    { label: "Premium Users", value: premiumUsers, icon: Crown, change: "+8%", color: "text-accent" },
    { label: "Total Books", value: books.length, icon: BookOpen, change: "+5%", color: "text-chart-3" },
    { label: "Total Reels", value: reels.length, icon: Video, change: "+15%", color: "text-chart-3" },
    { label: "Opportunities", value: opportunities.length, icon: Briefcase, change: "+3%", color: "text-chart-2" },
    { label: "Total Revenue", value: `₦${totalRevenue.toLocaleString()}`, icon: CreditCard, change: "+20%", color: "text-green-400" },
    { label: "Pending Feedback", value: pendingFeedback, icon: MessageSquare, change: "", color: "text-orange-400" },
    { label: "Active Users", value: profiles.filter(p => p.rank && p.rank <= 100).length, icon: UserCheck, change: "+6%", color: "text-chart-4" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">Welcome back, Admin. Here's your platform summary.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                {stat.change && (
                  <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#userGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-400" /> Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Engagement + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Content Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={engagementData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {engagementData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {engagementData.map(e => (
                <div key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: e.fill }} />
                  {e.name} ({e.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Content */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Top Books</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topBooks.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground">{b.views_count} views · {b.downloads_count} downloads</p>
                </div>
              </div>
            ))}
            {topBooks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No books yet</p>}
          </CardContent>
        </Card>

        {/* Most Active */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Most Active Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostActiveUsers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Rank #{u.rank}</span>
                    {u.is_premium && <Badge className="bg-accent/20 text-accent text-[9px] h-4">Premium</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
