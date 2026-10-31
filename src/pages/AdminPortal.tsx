import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar, AdminSection } from "@/components/admin/AdminSidebar";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { ContentManagement } from "@/components/admin/ContentManagement";
import { PaymentManagement } from "@/components/admin/PaymentManagement";
import { ContentAnalytics } from "@/components/admin/ContentAnalytics";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { AdminRoles } from "@/components/admin/AdminRoles";
import { ActivityLogs } from "@/components/admin/ActivityLogs";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { PastQuestionsManagement } from "@/components/admin/PastQuestionsManagement";
import { TutorVerificationManagement } from "@/components/admin/TutorVerificationManagement";
import { VirtualClassesManagement } from "@/components/admin/VirtualClassesManagement";
import { toast } from "sonner";

export default function AdminPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/auth"); return; }
      setUser(session.user);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    if (isAdmin) loadAllData();
  }, [isAdmin]);

  const loadAllData = async () => {
    const [profilesRes, feedbackRes, booksRes, reelsRes, oppsRes, purchasesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("books").select("*").order("created_at", { ascending: false }),
      supabase.from("reels").select("*").order("created_at", { ascending: false }),
      supabase.from("opportunities").select("*").order("created_at", { ascending: false }),
      supabase.from("book_purchases").select("*").order("purchased_at", { ascending: false }),
    ]);

    setProfiles(profilesRes.data || []);
    setFeedbacks(feedbackRes.data || []);
    setBooks(booksRes.data || []);
    setReels(reelsRes.data || []);
    setOpportunities(oppsRes.data || []);
    setPurchases(purchasesRes.data || []);
  };

  const logActivity = async (action: string, targetType: string, targetId: string, details: string) => {
    if (!user) return;
    await supabase.from("activity_logs").insert({
      admin_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const pendingFeedback = feedbacks.filter(f => f.status === "pending").length;

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview profiles={profiles} books={books} reels={reels} opportunities={opportunities} feedbacks={feedbacks} purchases={purchases} />;
      case "users":
        return <UserManagement profiles={profiles} onRefresh={loadAllData} onLogActivity={logActivity} />;
      case "tutors":
        return <TutorVerificationManagement onLogActivity={logActivity} />;
      case "past_questions":
        return <PastQuestionsManagement onLogActivity={logActivity} />;
      case "virtual_classes":
        return <VirtualClassesManagement onLogActivity={logActivity} />;
      case "content":
        return <ContentManagement books={books} reels={reels} opportunities={opportunities} onRefresh={loadAllData} onLogActivity={logActivity} />;
      case "payments":
        return <PaymentManagement purchases={purchases} books={books} profiles={profiles} />;
      case "analytics":
        return <ContentAnalytics books={books} reels={reels} opportunities={opportunities} />;
      case "notifications":
        return <NotificationsPanel profiles={profiles} onLogActivity={logActivity} />;
      case "feedback":
        return <FeedbackManagement feedbacks={feedbacks} onRefresh={loadAllData} onLogActivity={logActivity} />;
      case "admins":
        return <AdminRoles profiles={profiles} onRefresh={loadAllData} onLogActivity={logActivity} />;
      case "logs":
        return <ActivityLogs profiles={profiles} />;
      case "settings":
        return <AdminSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={() => navigate("/dashboard")}
        pendingFeedback={pendingFeedback}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
