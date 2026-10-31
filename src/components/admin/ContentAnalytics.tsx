import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { Eye, Heart, Share2, MessageCircle } from "lucide-react";

interface ContentAnalyticsProps {
  books: any[];
  reels: any[];
  opportunities: any[];
}

export function ContentAnalytics({ books, reels, opportunities }: ContentAnalyticsProps) {
  const totalBookViews = books.reduce((s, b) => s + (b.views_count || 0), 0);
  const totalReelViews = reels.reduce((s, r) => s + (r.views_count || 0), 0);
  const totalReelLikes = reels.reduce((s, r) => s + (r.likes_count || 0), 0);
  const totalOppViews = opportunities.reduce((s, o) => s + (o.views_count || 0), 0);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    books.forEach(b => { cats[b.category] = (cats[b.category] || 0) + (b.views_count || 0); });
    return Object.entries(cats).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 8);
  }, [books]);

  const topBooks = useMemo(() => [...books].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 10), [books]);
  const topReels = useMemo(() => [...reels].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 10), [reels]);
  const topOpps = useMemo(() => [...opportunities].sort((a, b) => (b.applications_count || 0) - (a.applications_count || 0)).slice(0, 10), [opportunities]);

  const pieData = [
    { name: "Books", value: totalBookViews, fill: "hsl(var(--chart-1))" },
    { name: "Reels", value: totalReelViews, fill: "hsl(var(--chart-3))" },
    { name: "Opportunities", value: totalOppViews, fill: "hsl(var(--chart-2))" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content Analytics</h1>
        <p className="text-sm text-muted-foreground">Track how your content performs across the platform</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Book Views", value: totalBookViews, icon: Eye, color: "text-primary" },
          { label: "Reel Views", value: totalReelViews, icon: Eye, color: "text-chart-3" },
          { label: "Reel Likes", value: totalReelLikes, icon: Heart, color: "text-destructive" },
          { label: "Opportunity Views", value: totalOppViews, icon: Eye, color: "text-chart-2" },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views by type */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Views Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map(e => (
                <div key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: e.fill }} />{e.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category performance */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Top Categories (Books)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Content Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Most Viewed Books</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topBooks.map((b, i) => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <span className="text-sm text-foreground truncate flex-1">{b.title}</span>
                <span className="text-xs text-muted-foreground">{b.views_count} views</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Most Watched Reels</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topReels.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <span className="text-sm text-foreground truncate flex-1">{r.title || "Untitled"}</span>
                <span className="text-xs text-muted-foreground">{r.views_count} views</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Most Applied Opportunities</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topOpps.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <span className="text-sm text-foreground truncate flex-1">{o.title}</span>
                <span className="text-xs text-muted-foreground">{o.applications_count} apps</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
