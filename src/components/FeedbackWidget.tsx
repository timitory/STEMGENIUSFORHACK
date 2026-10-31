import { useState, useEffect } from "react";
import { MessageSquarePlus, Send, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to submit feedback");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setCategory("general");
        setSubject("");
        setMessage("");
      }, 2000);
    } catch (error: any) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-110"
        title="Send Feedback"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquarePlus className="w-6 h-6" />}
      </button>

      {/* Feedback panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {submitted ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">Thank you!</h3>
              <p className="text-sm text-muted-foreground mt-1">Your feedback has been submitted.</p>
            </div>
          ) : (
            <>
              <div className="bg-primary/10 p-4 border-b border-border">
                <h3 className="text-lg font-bold text-foreground">Send Feedback</h3>
                <p className="text-xs text-muted-foreground">We'd love to hear from you</p>
              </div>
              <div className="p-4 space-y-3">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Feedback</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="praise">Praise</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={100}
                />
                <Textarea
                  placeholder="Tell us what's on your mind..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2">
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : "Submit Feedback"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
