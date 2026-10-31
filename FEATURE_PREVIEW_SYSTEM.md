# Feature Preview System Documentation

## Overview

The Feature Preview System allows unauthenticated users to try certain features of the app with limited access. Each feature can be tried **once** without logging in, and any attempt to perform meaningful actions (saving data, uploading content, etc.) will trigger an authentication requirement.

## How It Works

### Core Components

#### 1. **FeaturePreviewContext** (`src/contexts/FeaturePreviewContext.tsx`)
Manages the state of preview feature access across the application:

- **Tracks accessed features**: Stores which features have been used in preview mode (stored in localStorage)
- **Authentication modal**: Shows/hides the auth modal when features require login
- **Feature reset**: Clears preview access when user logs in

**Previewable Features:**
- `voice_tutor` - Voice STEM Tutor feature
- `marketplace` - STEM Marketplace browsing
- `homework_helper` - AI Homework Helper
- `stem_reels` - TikTok-style reels

#### 2. **useFeatureAuth Hook** (`src/hooks/useFeatureAuth.ts`)
Custom hook for individual feature pages to manage authentication requirements:

```typescript
const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("feature_name");
```

**Returns:**
- `user`: Current authenticated user (null if not logged in)
- `isLoading`: Whether auth state is loading
- `isPreviewAvailable`: Boolean indicating if feature preview is still available
- `checkAuthRequired(message)`: Returns true if auth is required, shows modal if needed
- `markFeatureAccessed()`: Manually mark feature as accessed

#### 3. **FeaturePreviewAuthModal** (`src/components/FeaturePreviewAuthModal.tsx`)
Reusable modal component that appears when users try to perform auth-required actions. Displays login/signup buttons.

#### 4. **FeaturePreviewProvider** (in `src/App.tsx`)
Wraps the entire app to provide context and modal to all components.

## Usage Examples

### Voice STEM Tutor
```tsx
const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("voice_tutor");

const processQuestion = async (question: string) => {
  // Check if auth is required before saving
  const authRequired = checkAuthRequired("Log in to save your chat history.");
  if (authRequired) return;
  
  // User can perform action once without auth, then needs to login
  // ...rest of logic
};
```

**Behavior:**
- ✅ Users can ask questions and get responses without logging in (first time only)
- ❌ Attempting to ask a second question without logging in triggers auth modal
- ✅ Chat history is NOT saved unless user is logged in
- 📱 Preview banner shown to indicate preview mode

### Marketplace
```tsx
const { user, isPreviewAvailable } = useFeatureAuth("marketplace");

const handlePublishClick = () => {
  if (!user) {
    navigate("/auth?mode=signup");
    return;
  }
  navigate("/marketplace/publish");
};
```

**Behavior:**
- ✅ Users can browse all marketplace content without logging in
- ❌ "Publish Book" and "My Dashboard" buttons redirect to auth if not logged in
- 📱 Preview banner shown to indicate limited access

### AI Homework Helper
```tsx
const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("homework_helper");

const handleSubmit = async () => {
  // Check auth before submitting
  const authRequired = checkAuthRequired("Log in to save your homework history.");
  if (authRequired) return;
  
  // Process first question without auth
  // ...
};
```

**Behavior:**
- ✅ Users can solve one homework problem without logging in
- ❌ Second attempt triggers auth modal
- ✅ Solution is displayed but NOT saved without login
- 📱 Preview banner shown

### STEM Reels
```tsx
const { user, isPreviewAvailable } = useFeatureAuth("stem_reels");

const handleUpload = async () => {
  if (!user) {
    navigate("/auth?mode=signup");
    return;
  }
  // Upload logic...
};
```

**Behavior:**
- ✅ Users can view/scroll through reels without logging in
- ❌ Uploading reels requires authentication
- ❌ Liking/commenting requires authentication
- 📱 Preview banner shown in top-left corner

## Data Persistence

**Important:** No data is saved to the database for unauthenticated users using preview features.

- **Voice Tutor**: Chat history is NOT saved without login
- **Homework Helper**: Solutions are NOT saved without login
- **Marketplace**: Browsing is read-only (no purchases without login)
- **STEM Reels**: Uploads and likes NOT saved without login

## Feature Access Tracking

The system stores accessed features in **localStorage** under the key `stem_genius_preview_features`.

```javascript
// Example: localStorage content
// ["voice_tutor", "homework_helper"]
```

This data is:
- ✅ Persisted across page refreshes/browser sessions
- ✅ Used to determine if first-time preview access is available
- ❌ Cleared when user logs in (automatic reset)
- ❌ Not sent to server (purely client-side)

## Implementation Checklist

When adding preview support to a new feature:

1. **Identify the feature name** - Choose a descriptive identifier (e.g., `my_new_feature`)

2. **Add to PreviewableFeature type:**
   ```typescript
   // In FeaturePreviewContext.tsx
   export type PreviewableFeature = "..." | "my_new_feature";
   ```

3. **Update the page component:**
   ```typescript
   import { useFeatureAuth } from "@/hooks/useFeatureAuth";
   
   const MyFeaturePage = () => {
     const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("my_new_feature");
     
     // Use in component...
   };
   ```

4. **Add preview banner** (if appropriate):
   ```tsx
   {!user && isPreviewAvailable && (
     <Alert className="border-blue-200 bg-blue-50">
       <AlertCircle className="h-4 w-4 text-blue-600" />
       <AlertDescription className="text-blue-800">
         You're trying this feature as a preview...
       </AlertDescription>
     </Alert>
   )}
   ```

5. **Protect auth-required actions:**
   ```typescript
   const handleAction = () => {
     const authRequired = checkAuthRequired("Message about why login is needed.");
     if (authRequired) return;
     
     // Safe to perform action
   };
   ```

## Testing

To test the feature preview system:

1. **Clear localStorage** - Open DevTools → Application → LocalStorage → Clear
2. **Visit a preview feature** (e.g., Voice STEM Tutor) without logging in
3. **Perform a preview action** (ask a question)
4. **Attempt second action** - Should trigger auth modal
5. **Check localStorage** - Should contain `["voice_tutor"]`
6. **Log in** - Preview access should reset
7. **Visit again** - Should be able to preview once more

## Notes for Developers

- The context is auto-reset when user logs in via the `useFeatureAuth` hook
- Each feature has independent preview tracking (using one doesn't affect others)
- Users are shown clear messaging about preview limitations
- Modal automatically navigates to auth page after selection
- No server-side tracking needed (all client-side via localStorage)
