import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type PreviewableFeature = "voice_tutor" | "marketplace" | "homework_helper" | "stem_reels";

interface FeaturePreviewContextType {
  // Track which features have been accessed in preview mode
  accessedFeatures: Set<PreviewableFeature>;
  // Track if auth modal should be shown
  showAuthModal: boolean;
  authModalMessage: string;
  // Mark a feature as accessed
  markFeatureAccessed: (feature: PreviewableFeature) => void;
  // Check if a feature can be accessed in preview mode
  canAccessFeaturePreview: (feature: PreviewableFeature) => boolean;
  // Request authentication (shows modal)
  requireAuth: (message?: string) => void;
  // Close auth modal
  closeAuthModal: () => void;
  // Reset feature access (when user logs in)
  resetFeatureAccess: () => void;
}

const FeaturePreviewContext = createContext<FeaturePreviewContextType | undefined>(undefined);

const STORAGE_KEY = "stem_genius_preview_features";

export const FeaturePreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessedFeatures, setAccessedFeatures] = useState<Set<PreviewableFeature>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState("");

  // Load accessed features from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const features = JSON.parse(stored) as PreviewableFeature[];
        setAccessedFeatures(new Set(features));
      } catch (error) {
        console.error("Failed to load preview features from storage:", error);
      }
    }
  }, []);

  // Persist accessed features to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(accessedFeatures)));
  }, [accessedFeatures]);

  const markFeatureAccessed = useCallback((feature: PreviewableFeature) => {
    setAccessedFeatures((prev) => new Set([...prev, feature]));
  }, []);

  const canAccessFeaturePreview = useCallback((feature: PreviewableFeature) => {
    return !accessedFeatures.has(feature);
  }, [accessedFeatures]);

  const requireAuth = useCallback((message = "Please log in to continue using this feature.") => {
    setAuthModalMessage(message);
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const resetFeatureAccess = useCallback(() => {
    setAccessedFeatures(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <FeaturePreviewContext.Provider
      value={{
        accessedFeatures,
        showAuthModal,
        authModalMessage,
        markFeatureAccessed,
        canAccessFeaturePreview,
        requireAuth,
        closeAuthModal,
        resetFeatureAccess,
      }}
    >
      {children}
    </FeaturePreviewContext.Provider>
  );
};

export const useFeaturePreview = () => {
  const context = useContext(FeaturePreviewContext);
  if (!context) {
    throw new Error("useFeaturePreview must be used within FeaturePreviewProvider");
  }
  return context;
};
