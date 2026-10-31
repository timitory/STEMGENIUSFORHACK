import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Video, Calendar, Clock, Users, ExternalLink, Trash2,
  Radio, CheckCircle2, PlayCircle, Loader2, Search, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { VirtualClass } from "@/types/virtualClasses";
import { fetchVirtualClasses, updateClassStatus } from "@/lib/virtualClassService";

interface Props {
  onLogActivity: (action: string, targetType: string, targetId?: string, details?: any) => Promise<void>;
}

export function VirtualClassesManagement({ onLogActivity }: Props) {
  const [classes, setClasses] = useState<VirtualClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await fetchVirtualClasses();
      setClasses(data);
    } catch {
      toast.error("Failed to load virtual classes");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (cls: VirtualClass, newStatus: 'scheduled' | 'live' | 'ended' | 'cancelled') => {
    try {
      if (newStatus === 'cancelled') {
        if (!confirm(`Are you sure you want to cancel "${cls.title}"?`)) return;
      }

      await supabase
        .from("virtual_classes")
        .update({ status: newStatus })
        .eq("id", cls.id);

      toast.success(`Updated class status to ${newStatus}`);
      await onLogActivity(`class_${newStatus}`, "virtual_class", cls.id, { title: cls.title });
      loadClasses();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filtered = classes.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.host?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Virtual Classes & Webinars Moderation
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Supervise large-scale webinars, monitor live attendance, and manage recordings.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classes or hosts..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading classes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center glass-card border-border/60">
          <Video className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">No Virtual Classes Found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            There are no classes matching your current filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((cls) => {
            const isLive = cls.status === "live";
            return (
              <Card
                key={cls.id}
                className={`p-5 glass-card border transition-all ${
                  isLive
                    ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40"
                    : "border-border/60"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isLive ? (
                        <Badge className="bg-destructive text-destructive-foreground animate-pulse text-[10px] font-bold">
                          ● LIVE BROADCAST
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            cls.status === "ended"
                              ? "text-emerald-400 border-emerald-400/30"
                              : "text-primary border-primary/30"
                          }`}
                        >
                          {cls.status}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {cls.subject}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {cls.max_capacity} Seats
                      </Badge>
                    </div>

                    <h3 className="font-bold text-base text-foreground">{cls.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        Host: <strong className="text-foreground">{cls.host?.name || "Educator"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        {new Date(cls.scheduled_start).toLocaleString()} ({cls.duration_minutes}m)
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Room: {cls.room_id}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {cls.status === "live" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => window.open(`/virtual-classes/room/${cls.room_id}`, "_blank")}
                          className="h-8 text-xs bg-destructive text-destructive-foreground font-semibold gap-1.5"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          Moderate Live
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(cls, "ended")}
                          className="h-8 text-xs border-border/60"
                        >
                          End Session
                        </Button>
                      </>
                    ) : cls.status === "ended" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(`/virtual-classes/summary/${cls.room_id}`, "_blank")}
                        className="h-8 text-xs gap-1.5"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-primary" />
                        View Summary & Recording
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => window.open(`/virtual-classes/room/${cls.room_id}`, "_blank")}
                          className="h-8 text-xs bg-primary text-primary-foreground font-semibold gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Preview Room
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(cls, "cancelled")}
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

