import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Bell, Trophy, Book, Video, MessageCircle, Gift, 
  Users, CheckCircle2, Clock, Trash2, Settings, BellOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "achievement" | "quiz" | "social" | "purchase" | "system" | "admin";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();

      // Subscribe to real-time changes
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Notification change:', payload);
            loadNotifications(); // Reload notifications on any change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        toast.error('Failed to load notifications');
        return;
      }

      // Transform the data to match the Notification interface
      const transformedNotifications: Notification[] = data.map(item => ({
        id: item.id,
        type: item.type as Notification['type'],
        title: item.title,
        message: item.message,
        timestamp: new Date(item.created_at),
        read: item.read,
        actionUrl: item.action_url
      }));

      setNotifications(transformedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "achievement": return <Trophy className="w-5 h-5 text-accent" />;
      case "quiz": return <Book className="w-5 h-5 text-primary" />;
      case "social": return <Users className="w-5 h-5 text-blue-500" />;
      case "purchase": return <Gift className="w-5 h-5 text-green-500" />;
      case "system": return <Bell className="w-5 h-5 text-muted-foreground" />;
      case "admin": return <Settings className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        toast.error('Failed to mark as read');
        return;
      }

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      toast.success("Marked as read");
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        toast.error('Failed to mark all as read');
        return;
      }

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting notification:', error);
        toast.error('Failed to delete notification');
        return;
      }

      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notification deleted");
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const clearAll = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing all notifications:', error);
        toast.error('Failed to clear all notifications');
        return;
      }

      setNotifications([]);
      toast.success("All notifications cleared");
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      toast.error('Failed to clear all notifications');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <Badge className="bg-primary">{unreadCount}</Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Stay updated with your activities</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear all
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="achievement">Achievements</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredNotifications.length === 0 ? (
                <Card className="p-12 text-center">
                  <BellOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No notifications</h3>
                  <p className="text-muted-foreground">You're all caught up!</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <Card 
                      key={notification.id}
                      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                        !notification.read ? "bg-primary/5 border-primary/20" : "bg-card"
                      }`}
                      onClick={() => {
                        markAsRead(notification.id);
                        if (notification.actionUrl) {
                          navigate(notification.actionUrl);
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          !notification.read ? "bg-primary/10" : "bg-secondary"
                        }`}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(notification.timestamp)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-primary absolute top-4 right-4" />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
