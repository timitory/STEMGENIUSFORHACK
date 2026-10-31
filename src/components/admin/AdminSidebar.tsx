import {
  LayoutDashboard, Users, FileText, CreditCard, BarChart3,
  Bell, MessageSquare, ShieldCheck, ScrollText, Settings,
  LogOut, ChevronLeft, ChevronRight, GraduationCap, Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type AdminSection =
  | "dashboard"
  | "users"
  | "tutors"
  | "past_questions"
  | "virtual_classes"
  | "content"
  | "payments"
  | "analytics"
  | "notifications"
  | "feedback"
  | "admins"
  | "logs"
  | "settings";

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onBack: () => void;
  pendingFeedback: number;
}

const navItems: { id: AdminSection; label: string; icon: React.ElementType; badge?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "tutors", label: "Tutor Approvals", icon: Users },
  { id: "past_questions", label: "Past Questions", icon: GraduationCap },
  { id: "virtual_classes", label: "Virtual Classes", icon: Video },
  { id: "content", label: "Content", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "feedback", label: "Feedback", icon: MessageSquare, badge: true },
  { id: "admins", label: "Admin Roles", icon: ShieldCheck },
  { id: "logs", label: "Activity Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ activeSection, onSectionChange, onBack, pendingFeedback }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button - appears at top of page via parent */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      
      <aside
        className={cn(
          "h-screen sticky top-0 flex flex-col border-r border-border bg-card transition-all duration-300 md:translate-x-0 md:relative",
          "fixed md:static inset-y-0 left-0 z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16 w-14" : "md:w-64 w-52 sm:w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-16 border-b border-border shrink-0">
          <ShieldCheck className="w-6 sm:w-7 h-6 sm:h-7 text-primary shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-xs sm:text-sm font-bold text-foreground leading-tight">STEM Genius</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Admin Portal</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 sm:py-4 px-1.5 sm:px-2 space-y-0.5 sm:space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSectionChange(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[40px] sm:min-h-auto",
                activeSection === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && pendingFeedback > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full shrink-0">
                      {pendingFeedback}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all min-h-[40px] sm:min-h-auto"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
            {!collapsed && <span className="truncate">Collapse</span>}
          </button>
          <button
            onClick={() => {
              onBack();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all min-h-[40px] sm:min-h-auto"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            {!collapsed && <span className="truncate">Back to App</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
