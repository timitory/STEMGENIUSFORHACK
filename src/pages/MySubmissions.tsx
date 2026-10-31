import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Upload, Clock, Loader2, AlertCircle } from "lucide-react";

interface Submission {
  id: string;
  title: string;
  institution_name: string;
  course_title: string;
  course_code: string | null;
  academic_session: string;
  status: string;
  created_at: string;
  reviewer_notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:             { label: "Draft",             className: "bg-secondary/60 text-muted-foreground border-border/40" },
  pending:           { label: "Pending Review",    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  changes_requested: { label: "Changes Requested", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  approved:          { label: "Approved",          className: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected:          { label: "Rejected",          className: "bg-red-500/20 text-red-400 border-red-500/30" },
  published:         { label: "Published",         className: "bg-primary/20 text-primary border-primary/30" },
};

export default function MySubmissions() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const [{ data: prof }, { data: subs, error: subsError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        (supabase as any)
          .from("user_submitted_collections")
          .select("id,title,institution_name,course_title,course_code,academic_session,status,created_at,reviewer_notes")
          .eq("submitted_by", session.user.id)
          .order("created_at", { ascending: false }),
      ]);

      setProfile(prof);
      if (subsError) {
        if (subsError.message?.includes("relation") || subsError.message?.includes("does not exist")) {
          setError("no_table");
        } else {
          setError(subsError.message);
        }
      } else {
        setSubmissions(subs || []);
      }
      setLoading(false);
    });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        userName={profile?.name || "Student"}
        isPremium={profile?.is_premium || false}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Back */}
        <Button
          variant="ghost" size="sm"
          onClick={() => navigate("/past-questions/university")}
          className="gap-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to University Past Questions
        </Button>

        {/* Title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              My Submissions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track the status of your past question contributions.
            </p>
          </div>
          <Button
            onClick={() => navigate("/past-questions/submit")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Submit New
          </Button>
        </div>

        {/* Content */}
        {error === "no_table" ? (
          <Card className="p-8 glass-card border-border/60 text-center space-y-3">
            <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">
              The submission tracking system is being set up.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Please check back in a few minutes. Your submissions will appear here once the system is ready.
            </p>
          </Card>
        ) : error ? (
          <Card className="p-6 glass-card border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </Card>
        ) : submissions.length === 0 ? (
          <Card className="p-10 glass-card border-border/60 text-center space-y-4">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">No submissions yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Help fellow students by contributing past questions to our library.
              </p>
            </div>
            <Button
              onClick={() => navigate("/past-questions/submit")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Submit Past Questions
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const statusConf = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
              return (
                <Card key={sub.id} className="p-5 glass-card border-border/60 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {sub.title}
                        </h3>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${statusConf.className}`}>
                          {statusConf.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub.institution_name}
                        {sub.course_code && ` · ${sub.course_code}`}
                        {sub.course_title && ` — ${sub.course_title}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        Session: {sub.academic_session} · Submitted {new Date(sub.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {sub.reviewer_notes && (
                        <div className="mt-2 p-2.5 rounded-lg bg-secondary/40 border border-border/40">
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">Reviewer note: </span>
                            {sub.reviewer_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

