import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video } from "lucide-react";

export const LiveStreamButton = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleGoLive = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login to go live");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);

    try {
      const roomId = `live_${Date.now()}_${user.id}`;
      
      const { error } = await supabase
        .from("live_sessions")
        .insert({
          host_id: user.id,
          title,
          description,
          room_id: roomId,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Live session created!");
      setOpen(false);
      setTitle("");
      setDescription("");
      
      // Redirect to live session page (you'll need to create this)
      window.location.href = `/live/${roomId}`;
      
    } catch (error) {
      console.error(error);
      toast.error("Failed to create live session");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Video className="h-4 w-4" />
          Go Live
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Live Stream</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Stream Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button 
            onClick={handleGoLive} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Start Live Stream"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};