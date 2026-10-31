import { useState, useEffect } from "react";
import heroOpportunitiesImg from "@/assets/hero-opportunities.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, Search, MapPin, Calendar, Globe, Trophy, GraduationCap,
  Briefcase, Plus, ExternalLink, Clock, Users, Filter, Rocket, Send,
  Eye, BookOpen, Zap, Building
} from "lucide-react";

const CATEGORIES = [
  { value: "hackathon", label: "Hackathon", icon: Zap, color: "bg-chart-1/20 text-primary" },
  { value: "scholarship", label: "Scholarship", icon: GraduationCap, color: "bg-accent/20 text-accent" },
  { value: "grant", label: "Grant", icon: Trophy, color: "bg-chart-3/20 text-chart-3" },
  { value: "training", label: "Training", icon: BookOpen, color: "bg-chart-4/20 text-chart-4" },
  { value: "class", label: "Class", icon: GraduationCap, color: "bg-chart-5/20 text-chart-5" },
  { value: "event", label: "Event", icon: Calendar, color: "bg-primary/20 text-primary" },
  { value: "internship", label: "Internship", icon: Briefcase, color: "bg-accent/20 text-accent" },
  { value: "fellowship", label: "Fellowship", icon: Users, color: "bg-chart-3/20 text-chart-3" },
  { value: "competition", label: "Competition", icon: Trophy, color: "bg-chart-1/20 text-primary" },
  { value: "funding", label: "Funding", icon: Rocket, color: "bg-chart-4/20 text-chart-4" },
  { value: "other", label: "Other", icon: Globe, color: "bg-muted text-muted-foreground" },
];

interface Opportunity {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: string;
  organization: string | null;
  location: string | null;
  is_remote: boolean;
  deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  external_url: string | null;
  has_in_app_form: boolean;
  form_fields: any;
  eligibility: string | null;
  prize_amount: number;
  is_approved: boolean;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  tags: string[];
  created_at: string;
}

interface Application {
  id: string;
  opportunity_id: string;
  status: string;
  submitted_at: string;
  form_data: any;
}

export default function CareerOpportunities() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("browse");

  // Post opportunity state
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "", description: "", category: "event" as string, organization: "",
    location: "", is_remote: false, deadline: "", start_date: "", end_date: "",
    external_url: "", has_in_app_form: false, eligibility: "", prize_amount: 0, tags: ""
  });
  const [isPosting, setIsPosting] = useState(false);

  // Apply dialog state
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [applicationData, setApplicationData] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Detail dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadOpportunities();
      loadMyApplications();
    }
  }, [user]);

  const loadOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOpportunities((data as unknown as Opportunity[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load opportunities");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      setMyApplications((data as unknown as Application[]) || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handlePostOpportunity = async () => {
    if (!postForm.title.trim()) { toast.error("Title is required"); return; }
    setIsPosting(true);
    try {
      const { error } = await supabase.from("opportunities").insert({
        creator_id: user.id,
        title: postForm.title.trim(),
        description: postForm.description.trim() || null,
        category: postForm.category as any,
        organization: postForm.organization.trim() || null,
        location: postForm.location.trim() || null,
        is_remote: postForm.is_remote,
        deadline: postForm.deadline || null,
        start_date: postForm.start_date || null,
        end_date: postForm.end_date || null,
        external_url: postForm.external_url.trim() || null,
        has_in_app_form: postForm.has_in_app_form,
        form_fields: postForm.has_in_app_form ? [
          { name: "full_name", label: "Full Name", type: "text", required: true },
          { name: "email", label: "Email Address", type: "email", required: true },
          { name: "motivation", label: "Why are you interested?", type: "textarea", required: true },
          { name: "experience", label: "Relevant Experience", type: "textarea", required: false }
        ] : [],
        eligibility: postForm.eligibility.trim() || null,
        prize_amount: postForm.prize_amount || 0,
        tags: postForm.tags ? postForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      } as any);
      if (error) throw error;
      toast.success("Opportunity posted successfully!");
      setShowPostDialog(false);
      setPostForm({
        title: "", description: "", category: "event", organization: "",
        location: "", is_remote: false, deadline: "", start_date: "", end_date: "",
        external_url: "", has_in_app_form: false, eligibility: "", prize_amount: 0, tags: ""
      });
      loadOpportunities();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to post opportunity");
    } finally {
      setIsPosting(false);
    }
  };

  const handleApply = async () => {
    if (!selectedOpportunity) return;
    setIsApplying(true);
    try {
      const { error } = await supabase.from("opportunity_applications").insert({
        opportunity_id: selectedOpportunity.id,
        user_id: user.id,
        form_data: applicationData,
      } as any);
      if (error) {
        if (error.code === "23505") { toast.error("You've already applied"); return; }
        throw error;
      }
      await supabase.rpc("increment_opportunity_applications" as any, { opp_id: selectedOpportunity.id });
      toast.success("Application submitted!");
      setShowApplyDialog(false);
      setApplicationData({});
      loadMyApplications();
      loadOpportunities();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to submit application");
    } finally {
      setIsApplying(false);
    }
  };

  const openDetail = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setShowDetailDialog(true);
    supabase.rpc("increment_opportunity_views" as any, { opp_id: opp.id }).then(() => {}, console.error);
  };

  const openApply = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setApplicationData({});
    if (opp.external_url && !opp.has_in_app_form) {
      window.open(opp.external_url, "_blank");
    } else {
      setShowApplyDialog(true);
    }
  };

  const hasApplied = (oppId: string) => myApplications.some(a => a.opportunity_id === oppId);

  const filtered = opportunities.filter(o => {
    const matchesSearch = o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.organization || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || o.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  const isDeadlineSoon = (d: string | null) => {
    if (!d) return false;
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 7 * 86400000;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Career & Opportunities
              </h1>
              <p className="text-sm text-muted-foreground">Discover STEM events, scholarships, hackathons & more</p>
            </div>
          </div>
          <Button onClick={() => setShowPostDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Post Opportunity
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-4">
        <PageHeroBanner image={heroOpportunitiesImg} title="STEM Opportunities" subtitle="Discover scholarships, hackathons, internships, and more" badge="Discover" />
      </div>
      {/* Header */}
      {/* <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Career & Opportunities
              </h1>
              <p className="text-sm text-muted-foreground">Discover STEM events, scholarships, hackathons & more</p>
            </div>
          </div>
          <Button onClick={() => setShowPostDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Post Opportunity
          </Button>
        </div>
      </header> */}

      <main className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="my-applications">My Applications ({myApplications.length})</TabsTrigger>
            <TabsTrigger value="my-posts">My Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search opportunities..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.slice(0, 6).map(c => {
                const Icon = c.icon;
                return (
                  <Button key={c.value} variant={categoryFilter === c.value ? "default" : "outline"} size="sm"
                    onClick={() => setCategoryFilter(categoryFilter === c.value ? "all" : c.value)} className="gap-1.5">
                    <Icon className="w-3.5 h-3.5" /> {c.label}
                  </Button>
                );
              })}
            </div>

            {/* Opportunities Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Rocket className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">No opportunities found</p>
                <p className="text-sm">Try adjusting your filters or post a new opportunity</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(opp => {
                  const cat = getCategoryInfo(opp.category);
                  const Icon = cat.icon;
                  const applied = hasApplied(opp.id);
                  return (
                    <Card key={opp.id} className="hover:border-primary/40 transition-colors cursor-pointer group" onClick={() => openDetail(opp)}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <Badge variant="outline" className={`${cat.color} border-0 text-xs`}>
                            <Icon className="w-3 h-3 mr-1" /> {cat.label}
                          </Badge>
                          {isDeadlineSoon(opp.deadline) && (
                            <Badge variant="destructive" className="text-xs"><Clock className="w-3 h-3 mr-1" /> Closing soon</Badge>
                          )}
                        </div>
                        <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors line-clamp-2">{opp.title}</CardTitle>
                        {opp.organization && (
                          <CardDescription className="flex items-center gap-1 text-xs">
                            <Building className="w-3 h-3" /> {opp.organization}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{opp.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {opp.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {opp.is_remote ? "Remote" : opp.location}</span>
                          )}
                          {opp.deadline && (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(opp.deadline)}</span>
                          )}
                          {opp.prize_amount > 0 && (
                            <span className="flex items-center gap-1 text-accent"><Trophy className="w-3 h-3" /> ${opp.prize_amount.toLocaleString()}</span>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {opp.views_count}</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {opp.applications_count}</span>
                          </div>
                          {applied ? (
                            <Badge variant="secondary" className="text-xs">Applied ✓</Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); openApply(opp); }} className="text-xs">
                              Apply <Send className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-applications">
            {myApplications.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">No applications yet</p>
                <p className="text-sm">Browse opportunities and start applying</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications.map(app => {
                  const opp = opportunities.find(o => o.id === app.opportunity_id);
                  return (
                    <Card key={app.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{opp?.title || "Opportunity"}</p>
                          <p className="text-sm text-muted-foreground">Applied {formatDate(app.submitted_at)}</p>
                        </div>
                        <Badge variant={app.status === "accepted" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>
                          {app.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-posts">
            <MyPostedOpportunities userId={user?.id} onRefresh={loadOpportunities} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedOpportunity && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`${getCategoryInfo(selectedOpportunity.category).color} border-0`}>
                    {getCategoryInfo(selectedOpportunity.category).label}
                  </Badge>
                  {selectedOpportunity.is_remote && <Badge variant="secondary">Remote</Badge>}
                </div>
                <DialogTitle>{selectedOpportunity.title}</DialogTitle>
                {selectedOpportunity.organization && (
                  <DialogDescription className="flex items-center gap-1">
                    <Building className="w-4 h-4" /> {selectedOpportunity.organization}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="space-y-4">
                {selectedOpportunity.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedOpportunity.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedOpportunity.location && (
                    <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {selectedOpportunity.location}</div>
                  )}
                  {selectedOpportunity.deadline && (
                    <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4" /> Deadline: {formatDate(selectedOpportunity.deadline)}</div>
                  )}
                  {selectedOpportunity.start_date && (
                    <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Starts: {formatDate(selectedOpportunity.start_date)}</div>
                  )}
                  {selectedOpportunity.prize_amount > 0 && (
                    <div className="flex items-center gap-2 text-accent"><Trophy className="w-4 h-4" /> ${selectedOpportunity.prize_amount.toLocaleString()}</div>
                  )}
                </div>
                {selectedOpportunity.eligibility && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Eligibility</p>
                    <p className="text-sm text-muted-foreground">{selectedOpportunity.eligibility}</p>
                  </div>
                )}
                {selectedOpportunity.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedOpportunity.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {hasApplied(selectedOpportunity.id) ? (
                    <Button disabled className="flex-1">Already Applied ✓</Button>
                  ) : (
                    <Button className="flex-1 gap-2" onClick={() => { setShowDetailDialog(false); openApply(selectedOpportunity); }}>
                      <Send className="w-4 h-4" /> Apply Now
                    </Button>
                  )}
                  {selectedOpportunity.external_url && (
                    <Button variant="outline" onClick={() => window.open(selectedOpportunity.external_url!, "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply: {selectedOpportunity?.title}</DialogTitle>
            <DialogDescription>Fill out the form below to submit your application</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(selectedOpportunity?.form_fields as any[] || [
              { name: "full_name", label: "Full Name", type: "text", required: true },
              { name: "email", label: "Email Address", type: "email", required: true },
              { name: "motivation", label: "Why are you interested?", type: "textarea", required: true },
              { name: "experience", label: "Relevant Experience", type: "textarea", required: false }
            ]).map((field: any) => (
              <div key={field.name}>
                <Label>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                {field.type === "textarea" ? (
                  <Textarea value={applicationData[field.name] || ""} onChange={e => setApplicationData(prev => ({ ...prev, [field.name]: e.target.value }))} className="mt-1" />
                ) : (
                  <Input type={field.type || "text"} value={applicationData[field.name] || ""} onChange={e => setApplicationData(prev => ({ ...prev, [field.name]: e.target.value }))} className="mt-1" />
                )}
              </div>
            ))}
            <Button onClick={handleApply} disabled={isApplying} className="w-full gap-2">
              {isApplying ? "Submitting..." : <><Send className="w-4 h-4" /> Submit Application</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post an Opportunity</DialogTitle>
            <DialogDescription>Share a STEM opportunity with the community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="e.g. Google STEM Scholarship 2026" /></div>
            <div><Label>Description</Label><Textarea value={postForm.description} onChange={e => setPostForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category *</Label>
                <Select value={postForm.category} onValueChange={v => setPostForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Organization</Label><Input value={postForm.organization} onChange={e => setPostForm(f => ({ ...f, organization: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Location</Label><Input value={postForm.location} onChange={e => setPostForm(f => ({ ...f, location: e.target.value }))} className="mt-1" placeholder="City, Country" /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={postForm.is_remote} onCheckedChange={v => setPostForm(f => ({ ...f, is_remote: v }))} /><Label>Remote</Label></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Deadline</Label><Input type="date" value={postForm.deadline} onChange={e => setPostForm(f => ({ ...f, deadline: e.target.value }))} className="mt-1" /></div>
              <div><Label>Prize/Amount ($)</Label><Input type="number" value={postForm.prize_amount || ""} onChange={e => setPostForm(f => ({ ...f, prize_amount: Number(e.target.value) }))} className="mt-1" /></div>
            </div>
            <div><Label>Eligibility</Label><Input value={postForm.eligibility} onChange={e => setPostForm(f => ({ ...f, eligibility: e.target.value }))} className="mt-1" placeholder="e.g. African students aged 16-25" /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={postForm.tags} onChange={e => setPostForm(f => ({ ...f, tags: e.target.value }))} className="mt-1" placeholder="STEM, AI, Africa" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>External URL</Label><Input value={postForm.external_url} onChange={e => setPostForm(f => ({ ...f, external_url: e.target.value }))} className="mt-1" placeholder="https://..." /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={postForm.has_in_app_form} onCheckedChange={v => setPostForm(f => ({ ...f, has_in_app_form: v }))} /><Label>In-app form</Label></div>
            </div>
            <Button onClick={handlePostOpportunity} disabled={isPosting} className="w-full">
              {isPosting ? "Posting..." : "Post Opportunity"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyPostedOpportunities({ userId, onRefresh }: { userId: string | undefined; onRefresh: () => void }) {
  const [posts, setPosts] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from("opportunities").select("*").eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setPosts((data as unknown as Opportunity[]) || []);
        setLoading(false);
      });
  }, [userId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setPosts(p => p.filter(o => o.id !== id));
    onRefresh();
    toast.success("Opportunity deleted");
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (posts.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <Plus className="w-12 h-12 mx-auto mb-4 opacity-40" />
      <p className="text-lg font-medium">No posts yet</p>
      <p className="text-sm">Click "Post Opportunity" to share with the community</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {posts.map(p => (
        <Card key={p.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.applications_count} applications · {p.views_count} views</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>Delete</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
