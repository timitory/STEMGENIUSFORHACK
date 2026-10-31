import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Users, User, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { notifyAdminBroadcast } from "@/lib/notifications";

interface NotificationsPanelProps {
  profiles: any[];
  onLogActivity: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function NotificationsPanel({ profiles, onLogActivity }: NotificationsPanelProps) {
  const [messageType, setMessageType] = useState("announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProfiles = profiles.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (messageType === "targeted" && !targetUser) {
      toast.error("Please select a target user");
      return;
    }

    try {
      let successCount = 0;
      if (messageType === "announcement") {
        // Send to all users
        const userIds = profiles.map(p => p.id);
        successCount = await notifyAdminBroadcast(userIds, title, message);
      } else {
        // Send to specific user
        const success = await notifyAdminBroadcast([targetUser], title, message);
        successCount = success ? 1 : 0;
      }

      const target = messageType === "announcement" ? "all users" : profiles.find(p => p.id === targetUser)?.name;
      onLogActivity("Sent notification", "notification", targetUser || "all", `"${title}" to ${target}`);
      toast.success(`Notification sent to ${target} (${successCount} delivered)`);
      setTitle("");
      setMessage("");
      setTargetUser("");
    } catch (error) {
      toast.error("Failed to send notification");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notifications & Messaging</h1>
        <p className="text-sm text-muted-foreground">Send announcements and targeted messages to users</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setMessageType("announcement")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10"><Megaphone className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-medium text-foreground">Announcement</p>
              <p className="text-xs text-muted-foreground">Send to all users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setMessageType("targeted")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-accent/10"><User className="w-5 h-5 text-accent" /></div>
            <div>
              <p className="text-sm font-medium text-foreground">Targeted Message</p>
              <p className="text-xs text-muted-foreground">Send to specific user</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setMessageType("premium")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-chart-3/10"><Users className="w-5 h-5 text-chart-3" /></div>
            <div>
              <p className="text-sm font-medium text-foreground">Premium Users</p>
              <p className="text-xs text-muted-foreground">Send to premium only</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compose */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Compose {messageType === "announcement" ? "Announcement" : messageType === "targeted" ? "Targeted Message" : "Premium Message"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={messageType} onValueChange={setMessageType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="announcement">Announcement (All)</SelectItem>
              <SelectItem value="targeted">Targeted (Specific User)</SelectItem>
              <SelectItem value="premium">Premium Users Only</SelectItem>
            </SelectContent>
          </Select>

          {messageType === "targeted" && (
            <div className="space-y-2">
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {filteredProfiles.slice(0, 15).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTargetUser(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      targetUser === p.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {p.name}
                    {p.is_premium && <Badge className="bg-accent/20 text-accent text-[9px] border-0">Premium</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input placeholder="Notification title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Write your message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />

          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleSend}>
              <Send className="w-4 h-4" /> Send Notification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
