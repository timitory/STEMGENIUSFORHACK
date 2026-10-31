# Quick Integration Guide: Adding Preview Support to New Features

## TL;DR - 3 Steps to Add Preview Support

### Step 1: Add Feature Name to Type
```typescript
// In src/contexts/FeaturePreviewContext.tsx
export type PreviewableFeature = 
  | "voice_tutor" 
  | "marketplace" 
  | "homework_helper" 
  | "stem_reels"
  | "your_new_feature"  // ← Add here
```

### Step 2: Integrate Hook in Your Page
```typescript
import { useFeatureAuth } from "@/hooks/useFeatureAuth";

export default function YourFeaturePage() {
  const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("your_new_feature");
  
  // Rest of your component...
}
```

### Step 3: Protect Auth-Required Actions
```typescript
const handleImportantAction = async () => {
  // Check if auth is needed
  const authRequired = checkAuthRequired("Log in to use this feature fully.");
  if (authRequired) return;
  
  // Safe to proceed - either user is logged in or first preview use
  // ...
};
```

## Optional: Add Preview Banner

```tsx
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

{!user && isPreviewAvailable && (
  <Alert className="border-blue-200 bg-blue-50">
    <AlertCircle className="h-4 w-4 text-blue-600" />
    <AlertDescription className="text-blue-800">
      You're trying this feature as a preview. [Custom message about limitations]
    </AlertDescription>
  </Alert>
)}
```

## Example: Complete Integration

```typescript
import { useFeatureAuth } from "@/hooks/useFeatureAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function MyNewFeature() {
  const { user, isPreviewAvailable, checkAuthRequired } = useFeatureAuth("my_new_feature");
  const [data, setData] = useState(null);

  // Action that requires authentication
  const handleSaveData = async (newData) => {
    // This will allow first use without auth, then require login
    const authRequired = checkAuthRequired("Log in to save your data.");
    if (authRequired) return;

    // User is either logged in or using first preview
    setData(newData);
    
    // Only save to database if user is logged in
    if (user) {
      await saveToDB(newData);
    }
  };

  return (
    <div>
      {/* Show banner only for preview users */}
      {!user && isPreviewAvailable && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Preview mode - Log in to unlock full features and save your progress.
          </AlertDescription>
        </Alert>
      )}

      {/* Your feature UI */}
      <button onClick={() => handleSaveData({...})}>
        Save
      </button>
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Simple "Try Once" Feature
```typescript
const handleAction = async () => {
  const authRequired = checkAuthRequired("Please log in to continue.");
  if (authRequired) return;
  
  // Can perform action once without auth
  performAction();
};
```

### Pattern 2: Browse + Interact
```typescript
// Browsing works without auth
const handleBrowse = () => {
  // No auth check needed
};

// Interactions require auth
const handleInteract = async () => {
  if (!user) {
    navigate("/auth?mode=login");
    return;
  }
  // Perform interaction
};
```

### Pattern 3: View + Create
```typescript
// Viewing/reading allowed in preview
const handleView = () => {};

// Creating requires auth
const handleCreate = async () => {
  if (!user) {
    navigate("/auth?mode=signup");
    return;
  }
  // Create item
};
```

### Pattern 4: Full Preview with Auto-Save Protection
```typescript
const handleSubmit = async (formData) => {
  // Check auth before saving
  const authRequired = checkAuthRequired("Log in to save your work.");
  if (authRequired) return;

  // Process data
  const result = processData(formData);

  // Save to DB only if user is authenticated
  if (user) {
    await supabase.from("table").insert({
      user_id: user.id,
      ...result
    });
  } else {
    // Show result but don't save
    console.log("Preview mode - data not saved");
  }
};
```

## Customization Options

### Custom Auth Messages
```typescript
const authRequired = checkAuthRequired(
  "Log in to access this premium feature and save unlimited progress."
);
```

### Manual Feature Access Tracking
```typescript
const { markFeatureAccessed } = useFeatureAuth("feature_name");

// Manually mark feature as accessed if needed
markFeatureAccessed();
```

### Check Preview Availability Without Requiring
```typescript
const { isPreviewAvailable } = useFeatureAuth("feature_name");

if (isPreviewAvailable) {
  // Show "this is your one free try" message
}
```

## Testing Your Integration

```bash
# 1. Clear localStorage
# DevTools > Application > LocalStorage > Clear All

# 2. Visit your new feature
# Should see preview banner

# 3. Perform first action
# Should succeed without auth

# 4. Check localStorage
# Should show your feature: localStorage.getItem('stem_genius_preview_features')

# 5. Perform second action
# Should trigger auth modal

# 6. Log in
# Preview access reset, unlimited access granted

# 7. Clear localStorage and test as new user
```

## Troubleshooting

### Modal doesn't appear
- Check that `FeaturePreviewProvider` is in App.tsx
- Check that `FeaturePreviewAuthModal` is in App.tsx
- Verify feature name matches in type definition

### Data still saving for preview users
- Check that you're guarding saves with `if (user)`
- Ensure `checkAuthRequired()` is called BEFORE action
- Verify user state is from `useFeatureAuth` hook

### Preview not resetting after login
- This should happen automatically
- Force refresh if stuck
- Check localStorage is being cleared

## Questions?

Refer to:
- `FEATURE_PREVIEW_SYSTEM.md` - Full system documentation
- `src/pages/VoiceStemTutor.tsx` - Complete integration example
- `src/pages/STEMReels.tsx` - Browse + interact pattern
- `src/pages/AIHomeworkHelper.tsx` - Try once + save pattern
