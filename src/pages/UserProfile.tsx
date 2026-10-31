import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { notifyNewFollower, notifyProfileLike } from "@/lib/notifications";
import { ArrowLeft, UserPlus, UserCheck, Heart, Play, Share2, Users, Edit, Save, X, Mail, Phone, MapPin, User } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  is_premium: boolean;
  followers_count: number;
  following_count: number;
  likes_count: number;
  phone?: string;
  gender?: string;
  address?: string;
  email_confirmed?: boolean;
}

interface Reel {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  views_count: number;
  likes_count: number;
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    gender: "",
    address: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchProfile(),
      fetchUserReels(),
      checkCurrentUser(),
    ]);
    setIsLoading(false);
  };

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      
      // Check if following
      const { data: followData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();
      
      setIsFollowing(!!followData);

      // Check if liked
      const { data: likeData } = await supabase
        .from("profile_likes")
        .select("id")
        .eq("liker_id", user.id)
        .eq("liked_id", userId)
        .single();
      
      setHasLiked(!!likeData);
    }
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    if (data) {
      console.log("Fetched profile data:", data); // Debug log
      setProfile(data);
      // Populate edit form with current data
      setEditForm({
        name: data.name || "",
        phone: data.phone || "",
        gender: data.gender || "",
        address: data.address || "",
      });
    }
  };

  const fetchUserReels = async () => {
    const { data } = await supabase
      .from("reels")
      .select("*")
      .eq("user_id", userId)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (data) {
      setReels(data);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      toast.error("Please login to follow");
      return;
    }

    if (currentUserId === userId) {
      toast.error("You can't follow yourself");
      return;
    }

    if (isFollowing) {
      // Unfollow
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", userId);
      
      await supabase.rpc("decrement_followers", { profile_id: userId });
      setIsFollowing(false);
      toast.success("Unfollowed");
    } else {
      // Follow
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: currentUserId, following_id: userId });
      
      if (error) {
        toast.error("Failed to follow");
        return;
      }
      
      await supabase.rpc("increment_followers", { profile_id: userId });
      setIsFollowing(true);
      toast.success("Following!");

      // Create notification for the followed user
      if (profile?.full_name) {
        await notifyNewFollower(currentUserId, userId, profile.full_name);
      }
    }

    fetchProfile();
  };

  const handleLikeProfile = async () => {
    if (!currentUserId) {
      toast.error("Please login to like");
      return;
    }

    if (currentUserId === userId) {
      toast.error("You can't like your own profile");
      return;
    }

    if (hasLiked) {
      // Unlike
      await supabase
        .from("profile_likes")
        .delete()
        .eq("liker_id", currentUserId)
        .eq("liked_id", userId);
      
      setHasLiked(false);
      toast.success("Unliked");
    } else {
      // Like
      const { error } = await supabase
        .from("profile_likes")
        .insert({ liker_id: currentUserId, liked_id: userId });
      
      if (error) {
        toast.error("Failed to like");
        return;
      }
      
      await supabase.rpc("increment_profile_likes", { profile_id: userId });
      setHasLiked(true);
      toast.success("Liked!");

      // Create notification for the liked user
      if (profile?.full_name) {
        await notifyProfileLike(currentUserId, userId, profile.full_name);
      }
    }

    fetchProfile();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/profile/${userId}`;
    
    if (navigator.share) {
      await navigator.share({
        title: profile?.name || "User Profile",
        text: `Check out ${profile?.name}'s profile`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Profile link copied!");
    }
  };

  const handleEditProfile = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset form to current profile data
    if (profile) {
      setEditForm({
        name: profile.name || "",
        phone: profile.phone || "",
        gender: profile.gender || "",
        address: profile.address || "",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editForm.name,
          phone: editForm.phone,
          gender: editForm.gender,
          address: editForm.address,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        toast.error("Failed to update profile");
        return;
      }

      toast.success("Profile updated successfully!");
      setIsEditMode(false);
      await fetchProfile(); // Refresh profile data
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-3xl text-white font-bold">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={editForm.name}
                          onChange={(e) => handleFormChange("name", e.target.value)}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={editForm.phone}
                            onChange={(e) => handleFormChange("phone", e.target.value)}
                            placeholder="Enter your phone number"
                          />
                        </div>
                        <div>
                          <Label htmlFor="gender">Gender</Label>
                          <Select value={editForm.gender} onValueChange={(value) => handleFormChange("gender", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={editForm.address}
                          onChange={(e) => handleFormChange("address", e.target.value)}
                          placeholder="Enter your address"
                          rows={2}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold">{profile.name}</h1>
                      {profile.is_premium && (
                        <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 py-1 rounded-full">
                          ⭐ Premium
                        </span>
                      )}
                      
                      {/* Additional Profile Information */}
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {profile.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{profile.phone}</span>
                          </div>
                        )}
                        {profile.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{profile.address}</span>
                          </div>
                        )}
                        {profile.gender && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="capitalize">{profile.gender.replace('_', ' ')}</span>
                          </div>
                        )}
                        {profile.email_confirmed && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-green-600">Email Verified</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-bold text-lg">{reels.length}</p>
                  <p className="text-muted-foreground">Videos</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{profile.followers_count || 0}</p>
                  <p className="text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{profile.following_count || 0}</p>
                  <p className="text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{profile.likes_count || 0}</p>
                  <p className="text-muted-foreground">Likes</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              {currentUserId === userId ? (
                // Edit mode buttons for own profile
                isEditMode ? (
                  <>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button 
                      onClick={handleCancelEdit} 
                      variant="outline"
                      disabled={isSaving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleEditProfile} variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                )
              ) : (
                // Social buttons for other profiles
                <>
                  <Button 
                    onClick={handleFollow} 
                    variant={isFollowing ? "secondary" : "default"}
                    className={isFollowing ? "" : "bg-gradient-to-r from-primary to-purple-600"}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleLikeProfile} 
                    variant="outline" 
                    size="icon"
                    className={hasLiked ? "text-red-500" : ""}
                  >
                    <Heart className={`h-4 w-4 ${hasLiked ? "fill-red-500" : ""}`} />
                  </Button>
                  <Button onClick={handleShare} variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Play className="h-5 w-5" /> Videos
        </h2>
        
        {reels.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No videos yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {reels.map((reel) => (
              <Card
                key={reel.id}
                className="cursor-pointer hover:scale-105 transition-transform overflow-hidden"
                onClick={() => navigate(`/stem-reels?reelId=${reel.id}`, { state: { reelId: reel.id } })}
              >
                <div className="relative aspect-[9/16] bg-muted">
                  {reel.thumbnail_url ? (
                    <img
                      src={reel.thumbnail_url}
                      alt={reel.title || "Video"}
                      className="w-full h-full object-cover"
                    />
                  ) : reel.video_url ? (
                    <video
                      src={reel.video_url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-semibold truncate">
                      {reel.title || "Untitled"}
                    </p>
                    <div className="flex gap-3 text-xs text-white/80 mt-1">
                      <span>👁 {reel.views_count}</span>
                      <span>❤️ {reel.likes_count}</span>
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-full p-3">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;