import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Globe, Bell, Database } from "lucide-react";

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings & Security</h1>
        <p className="text-sm text-muted-foreground">Platform security and configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Two-Factor Authentication</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">IP Logging</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Session Timeout (30 min)</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Role-Based Access Control</Label>
              <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" /> Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Email on New Feedback</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Email on New Signup</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Email on Payment</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-chart-3" /> Platform Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Platform</span><span className="text-sm text-foreground">STEM Genius</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Version</span><span className="text-sm text-foreground">2.0.0</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Online</Badge></div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-chart-4" /> Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Backend</span><span className="text-sm text-foreground">Lovable Cloud</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Storage</span><Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Connected</Badge></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Auth</span><Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">Active</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
