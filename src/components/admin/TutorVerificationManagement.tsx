import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, CheckCircle2, XCircle, Clock, ShieldCheck, 
  Search, Eye, Award, DollarSign, Loader2, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { adminFetchTutorApplications, adminUpdateTutorStatus, adminAdjustTutorProfile } from "@/lib/tutorService";

interface TutorVerificationManagementProps {
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function TutorVerificationManagement({ onLogActivity }: TutorVerificationManagementProps) {
  const [tutors, setTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [inspectTutor, setInspectTutor] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [editRate, setEditRate] = useState<number>(0);
  const [editFree, setEditFree] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await adminFetchTutorApplications();
      setTutors(data);
    } catch (err) {
      console.error("Error loading tutor applications:", err);
      toast.error("Failed to load tutor applications");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInspect = (tutor: any) => {
    setInspectTutor(tutor);
    setReviewNotes(tutor.verification_notes || "");
    setEditRate(Number(tutor.hourly_rate || 0));
    setEditFree(Boolean(tutor.offers_free_sessions));
  };

  const handleSaveAdjustments = async () => {
    if (!inspectTutor) return;
    setIsProcessing(true);
    try {
      await adminAdjustTutorProfile(inspectTutor.id, {
        hourly_rate: editRate,
        offers_free_sessions: editFree,
        verification_notes: reviewNotes.trim() || undefined,
      });
      toast.success("Tutor rate and settings adjusted successfully!");
      onLogActivity("Adjusted tutor profile", "tutor_profile", inspectTutor.id, `Adjusted rate to ₦${editRate}`);
      loadApplications();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust tutor profile");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (tutor: any) => {
    setIsProcessing(true);
    try {
      // First save any adjustments made by admin
      await adminAdjustTutorProfile(tutor.id, {
        hourly_rate: editRate,
        offers_free_sessions: editFree,
        verification_notes: reviewNotes.trim() || undefined,
      });

      await adminUpdateTutorStatus(tutor.id, tutor.user_id, "verified", reviewNotes.trim() || undefined);
      toast.success(`Approved ${tutor.profiles?.name || "Tutor"}! Profile is now active.`);
      onLogActivity("Approved tutor", "tutor_profile", tutor.id, `Verified tutor: ${tutor.profiles?.name}`);
      setInspectTutor(null);
      loadApplications();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve tutor");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (tutor: any) => {
    setIsProcessing(true);
    try {
      await adminUpdateTutorStatus(tutor.id, tutor.user_id, "rejected", reviewNotes.trim() || undefined);
      toast.info(`Rejected application for ${tutor.profiles?.name || "Tutor"}`);
      onLogActivity("Rejected tutor", "tutor_profile", tutor.id, `Rejected tutor application`);
      setInspectTutor(null);
      loadApplications();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject tutor");
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = tutors.filter((t) => {
    const matchSearch =
      searchQuery === "" ||
      t.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.subjects && t.subjects.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchStatus = statusFilter === "all" || t.verification_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = tutors.filter((t) => t.verification_status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Tutor Applications & Verification
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review submitted credentials, verify academic degrees, and manage active educators.
          </p>
        </div>

        {pendingCount > 0 && (
          <Badge className="bg-accent/20 text-accent border-accent/30 text-xs px-3 py-1 font-semibold">
            {pendingCount} Application(s) Awaiting Review
          </Badge>
        )}
      </div>

      {/* Filter Bar */}
      <Card className="p-4 glass-card border-border/60 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by tutor name, headline, or subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-secondary/50 border-border/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["all", "pending", "verified", "rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-border/40"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </Card>

      {/* Applications List */}
      <Card className="glass-card border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading applications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No applications found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((tutor) => (
              <div
                key={tutor.id}
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {tutor.profiles?.name || "Applicant"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase ${
                        tutor.verification_status === "verified"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : tutor.verification_status === "pending"
                          ? "bg-accent/10 text-accent border-accent/30"
                          : "text-destructive border-destructive/30"
                      }`}
                    >
                      {tutor.verification_status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Rate: ₦{tutor.hourly_rate ? Number(tutor.hourly_rate).toLocaleString() : "0"}/hr
                    </span>
                  </div>

                  <p className="text-xs text-foreground/90 font-medium">{tutor.headline}</p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tutor.subjects?.map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenInspect(tutor)}
                    className="h-8 text-xs border-border/60 gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Review Credentials & Adjust
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* INSPECT & APPROVE MODAL */}
      <Dialog open={!!inspectTutor} onOpenChange={() => setInspectTutor(null)}>
        <DialogContent className="glass-card border-border/80 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Tutor Review & Adjustment: {inspectTutor?.profiles?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review submitted credentials, adjust marketplace fees or teaching settings, and verify or reject this applicant.
            </DialogDescription>
          </DialogHeader>

          {inspectTutor && (
            <div className="space-y-4 py-3">
              <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Headline</span>
                <p className="text-xs font-semibold text-foreground">{inspectTutor.headline}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground block">Biography</span>
                <p className="text-xs text-foreground/90 leading-relaxed p-3 rounded-lg bg-secondary/30 border border-border/40 whitespace-pre-line">
                  {inspectTutor.bio}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground block">Academic Qualifications</span>
                <div className="space-y-2">
                  {inspectTutor.qualifications && inspectTutor.qualifications.length > 0 ? (
                    inspectTutor.qualifications.map((q: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-xs flex justify-between">
                        <div>
                          <span className="font-semibold text-foreground">{q.title}</span>
                          <p className="text-[11px] text-muted-foreground">{q.institution} ({q.year})</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No specific diplomas entered.</p>
                  )}
                </div>
              </div>

              {/* Adjust Marketplace Rate & Free Options */}
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    Marketplace Fee Adjustments
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveAdjustments}
                    disabled={isProcessing}
                    className="text-xs h-7 px-2.5 text-primary hover:bg-primary/10"
                  >
                    Save Changes
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground font-semibold block mb-1">
                      Hourly Rate (₦ NGN)
                    </label>
                    <Input
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(Number(e.target.value))}
                      className="bg-background/80 text-xs h-8"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="editFreeCheckbox"
                      checked={editFree}
                      onChange={(e) => setEditFree(e.target.checked)}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <label htmlFor="editFreeCheckbox" className="text-xs text-foreground cursor-pointer font-medium">
                      Enable Free Intro Sessions
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Verification Notes / Feedback for Tutor (Optional)
                </label>
                <Textarea
                  placeholder="e.g. Verified with university records. Approved for teaching."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="bg-secondary/40 text-xs min-h-[60px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setInspectTutor(null)}
              className="border-border/60 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(inspectTutor)}
              disabled={isProcessing}
              className="text-xs font-semibold"
            >
              Reject Application
            </Button>
            <Button
              onClick={() => handleApprove(inspectTutor)}
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Approve & Activate Tutor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

