import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { notifyReelComment } from "@/lib/notifications";
import { Heart, Reply, Send, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  likes_count: number;
  profiles?: { name: string };
  replies?: Comment[];
}

interface CommentSectionProps {
  reelId: string;
  onCommentCountChange: () => void;
}

export const CommentSection = ({ reelId, onCommentCountChange }: CommentSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchLikedComments();
  }, [reelId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("reel_comments")
      .select("*")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      const commentsWithProfiles = data.map(c => ({ ...c, profiles: profiles?.find(p => p.id === c.user_id) || { name: "Unknown" } }));
      const topLevel = commentsWithProfiles.filter(c => !c.parent_id);
      const organized = topLevel.map(c => ({ ...c, replies: commentsWithProfiles.filter(r => r.parent_id === c.id) }));
      setComments(organized);
    }
    setIsLoading(false);
  };

  const fetchLikedComments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("reel_comment_likes").select("comment_id").eq("user_id", user.id);
    if (data) setLikedComments(new Set(data.map(l => l.comment_id)));
  };

  const handleComment = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please login to comment"); return; }
    if (!newComment.trim()) return;
    setIsPosting(true);
    const { error } = await supabase.from("reel_comments").insert({ reel_id: reelId, user_id: user.id, content: newComment });
    if (error) { toast.error("Failed to post"); setIsPosting(false); return; }
    await supabase.rpc("increment_reel_comments", { reel_id: reelId });
    setNewComment("");
    setIsPosting(false);
    fetchComments();
    onCommentCountChange();

    // Notify reel owner if it's not their own comment
    try {
      const { data: reel } = await supabase
        .from("reels")
        .select("user_id, title")
        .eq("id", reelId)
        .single();

      if (reel && reel.user_id !== user.id) {
        await notifyReelComment(
          user.id,
          reel.user_id,
          user.user_metadata?.full_name || user.email || "Someone",
          reel.title || "STEM Reel"
        );
      }
    } catch (error) {
      console.error("Error sending comment notification:", error);
    }
  };

  const handleReply = async (parentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please login"); return; }
    if (!replyContent.trim()) return;
    const { error } = await supabase.from("reel_comments").insert({ reel_id: reelId, user_id: user.id, content: replyContent, parent_id: parentId });
    if (error) { toast.error("Failed to reply"); return; }
    await supabase.rpc("increment_reel_comments", { reel_id: reelId });
    setReplyContent("");
    setReplyingTo(null);
    fetchComments();
    onCommentCountChange();
  };

  const handleLikeComment = async (commentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please login"); return; }
    const isLiked = likedComments.has(commentId);
    if (isLiked) {
      await supabase.from("reel_comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
      await supabase.rpc("decrement_comment_likes", { comment_id: commentId });
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    } else {
      await supabase.from("reel_comment_likes").insert({ comment_id: commentId, user_id: user.id });
      await supabase.rpc("increment_comment_likes", { comment_id: commentId });
      setLikedComments(prev => new Set(prev).add(commentId));
    }
    fetchComments();
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? "ml-10" : ""} py-3`}>
      <div className="flex gap-2.5">
        <Avatar className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} flex-shrink-0`}>
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
            {(comment.profiles?.name || "U").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{comment.profiles?.name || "Unknown"}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-4 mt-1.5">
            <button onClick={() => handleLikeComment(comment.id)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Heart className={`h-3 w-3 ${likedComments.has(comment.id) ? "fill-red-500 text-red-500" : ""}`} />
              {comment.likes_count > 0 && <span className="text-[10px]">{comment.likes_count}</span>}
            </button>
            {!isReply && (
              <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                <Reply className="h-3 w-3" />
                <span className="text-[10px]">Reply</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="flex gap-2 mt-2 ml-10">
          <Input placeholder="Write a reply..." value={replyContent} onChange={e => setReplyContent(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReply(comment.id)}
            className="h-8 text-xs bg-secondary border-border/50" />
          <Button size="sm" className="h-8 px-3" onClick={() => handleReply(comment.id)}>
            <Send className="w-3 h-3" />
          </Button>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1">
          {comment.replies.map(reply => <CommentItem key={reply.id} comment={reply} isReply />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to comment!</p>
          </div>
        ) : (
          comments.map(c => <CommentItem key={c.id} comment={c} />)
        )}
      </div>
      <div className="flex gap-2 pt-3 pb-2 border-t border-border/30 bg-card sticky bottom-0">
        <Input placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && handleComment()}
          className="h-9 text-sm bg-secondary border-border/50" />
        <Button onClick={handleComment} disabled={isPosting || !newComment.trim()} size="sm" className="h-9 px-4">
          {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
};
