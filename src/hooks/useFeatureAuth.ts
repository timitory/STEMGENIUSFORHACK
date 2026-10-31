import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeaturePreview, PreviewableFeature } from "@/contexts/FeaturePreviewContext";

/**
 * Hook to handle authentication requirements for preview features.
 * Returns info about user auth state and helper functions for feature access.
 */
export const useFeatureAuth = (feature: PreviewableFeature) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { canAccessFeaturePreview, markFeatureAccessed, requireAuth } = useFeaturePreview();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Check if user can access feature in preview mode
   */
  const isPreviewAvailable = canAccessFeaturePreview(feature);

  /**
   * Require authentication for an action
   * If user is not logged in and feature preview has been used, shows auth modal
   * If user is not logged in and feature preview is available, marks it as accessed
   */
  const requireAuthForAction = (actionMessage = "Please log in to continue.") => {
    if (user) {
      // User is logged in, allow action
      return true;
    }

    if (isPreviewAvailable) {
      // First preview access - mark as accessed but allow the action
      markFeatureAccessed(feature);
      return true;
    }

    // Preview already used, require authentication
    requireAuth(actionMessage);
    return false;
  };

  /**
   * Check if should require auth BEFORE performing action
   * Used for actions that should only be available to logged-in users
   */
  const checkAuthRequired = (actionMessage = "Please log in to save your progress.") => {
    if (user) {
      return false; // Auth not required, user is logged in
    }

    if (isPreviewAvailable) {
      // Mark preview as used
      markFeatureAccessed(feature);
      return false; // Still allow first use
    }

    // Need authentication
    requireAuth(actionMessage);
    return true;
  };

  return {
    user,
    isLoading,
    isPreviewAvailable,
    requireAuthForAction,
    checkAuthRequired,
    markFeatureAccessed: () => markFeatureAccessed(feature),
  };
};
