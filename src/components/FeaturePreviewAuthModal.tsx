import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFeaturePreview } from "@/contexts/FeaturePreviewContext";
import { LogIn, UserPlus } from "lucide-react";

export const FeaturePreviewAuthModal: React.FC = () => {
  const navigate = useNavigate();
  const { showAuthModal, authModalMessage, closeAuthModal } = useFeaturePreview();

  const handleLogin = () => {
    closeAuthModal();
    navigate("/auth?mode=login");
  };

  const handleSignup = () => {
    closeAuthModal();
    navigate("/auth?mode=signup");
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={closeAuthModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Authentication Required</DialogTitle>
          <DialogDescription>{authModalMessage}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2"
            variant="default"
          >
            <LogIn className="w-4 h-4" />
            Log In
          </Button>
          <Button
            onClick={handleSignup}
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground pt-2">
          You can try this feature once without logging in. Sign in to unlock unlimited access.
        </p>
      </DialogContent>
    </Dialog>
  );
};
