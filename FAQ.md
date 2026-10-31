# Feature Preview System - FAQ

## General Questions

### Q: What happens to preview user data?
**A:** Nothing! Preview data is **never saved** to the database. Users see results/responses, but history/progress is not persisted. Data is only saved after user logs in.

### Q: Can users use multiple features in preview mode?
**A:** No. Each feature can be tried once independently. Using preview on "Voice Tutor" doesn't prevent preview on "Homework Helper" - they're tracked separately.

### Q: Is preview user information stored?
**A:** No. Preview is completely client-side using localStorage. No server queries, no tracking, no analytics - just local state.

### Q: What happens when a preview user logs in?
**A:** Preview access is automatically reset. localStorage is cleared. User can use all features unlimited with full data persistence. Fresh start after login.

### Q: Can preview users see other users' content?
**A:** Yes! Reading/viewing (marketplace browsing, watching reels) is allowed in preview. Only write/create actions require auth.

---

## Technical Questions

### Q: How is preview state persisted across browser sessions?
**A:** Using the browser's localStorage API with key `stem_genius_preview_features`. Value is a JSON array of accessed feature names.

### Q: Will preview state persist across devices?
**A:** No. localStorage is device/browser-specific. Same user on different device = fresh preview state.

### Q: What if user clears localStorage manually?
**A:** Preview state resets. User can try features again. This is intentional - no enforcement mechanism.

### Q: How does preview interact with the auth system?
**A:** Preview and auth are separate systems that integrate:
- Preview tracks feature usage (localStorage)
- Auth manages user identity (Supabase)
- They communicate via the `useFeatureAuth` hook

### Q: Can I track preview metrics?
**A:** Yes! Add analytics calls in the context or hook:
```typescript
// In useFeatureAuth.ts
checkAuthRequired(message) {
  analytics.track('preview_auth_required', { feature });
  requireAuth(message);
}
```

### Q: Is there a way to disable preview for a feature?
**A:** Yes! In `FeaturePreviewContext.tsx`, modify the type definition to exclude the feature:
```typescript
export type PreviewableFeature = "voice_tutor" | "marketplace";
// Removed "homework_helper"
```

### Q: What if someone hacks localStorage to bypass preview limit?
**A:** If they fake the localStorage data, they can "unlock" preview again. But:
- No backend access without auth
- Data still won't save without user.id
- This is expected behavior - client-side state isn't secure

---

## Product/Design Questions

### Q: Why allow preview at all? Why not just force login?
**A:** Preview dramatically increases conversion:
- Users experience value before committing
- Reduces immediate auth friction
- Shows what they're missing (motivates signup)
- Industry standard (YouTube, TikTok, etc.)

### Q: Should preview limit features or just data saving?
**A:** The design allows full feature access but prevents saves:
```
✅ Voice Tutor: Can ask unlimited questions in preview
❌ Voice Tutor: Can't save history without login
```
This balances user experience with conversion.

### Q: What message should show in preview banner?
**A:** Keep it positive and clear:
```
✅ "You're trying this feature as a preview. Log in to save your progress."
❌ "This is a limited preview mode with restrictions."
```

### Q: Should I show preview banner for logged-in users?
**A:** No! Add this check:
```tsx
{!user && isPreviewAvailable && (
  <Alert>...</Alert>
)}
```

### Q: Can I require login without preview for some features?
**A:** Yes! Don't use `useFeatureAuth` for those pages. Add auth redirect directly:
```tsx
useEffect(() => {
  if (!user) navigate("/auth");
}, [user]);
```

---

## Integration Questions

### Q: How do I add preview to a new feature?
**A:** 3 steps:
1. Add to type: `export type PreviewableFeature = "..." | "my_feature"`
2. Use hook: `const { checkAuthRequired } = useFeatureAuth("my_feature")`
3. Protect action: `if (checkAuthRequired()) return;`

See `QUICK_INTEGRATION_GUIDE.md` for examples.

### Q: What if my feature has complex auth logic?
**A:** Use `checkAuthRequired()` as the primary guard, add custom logic after:
```typescript
const handleAction = async () => {
  const authRequired = checkAuthRequired("Message");
  if (authRequired) return;
  
  // Your custom logic here
  if (specialCondition) {
    // Custom handling
  }
};
```

### Q: Can I use preview with role-based access control?
**A:** Yes! Preview bypasses role checks (assumes preview = anon user). After login, normal RBAC applies:
```typescript
if (!user) {
  // Preview mode - allow
  return true;
}

// Logged in - check roles
return user.role === 'admin';
```

### Q: What about preview on components, not full pages?
**A:** Same pattern works! Use `useFeatureAuth` in any component:
```tsx
const MyComponent = () => {
  const { checkAuthRequired } = useFeatureAuth("feature");
  
  const handleClick = () => {
    if (checkAuthRequired()) return;
    // Component logic
  };
};
```

---

## Data Questions

### Q: How do I know if a database record is from a preview user?
**A:** You can't! Preview data isn't saved. If it's in the database, they were logged in.

### Q: Can I migrate preview user data when they log in?
**A:** No data to migrate. Preview state is client-side only. After login is a fresh start with zero previous history.

### Q: What if I want to save some preview data?
**A:** Modify the save logic:
```typescript
// Always save, even for preview users
if (true) { // Remove the `if (user)` check
  await supabase.from("table").insert({
    // Include anonymous_id or something
    ..., data
  });
}
```
Then query as "anonymous user" data after login.

### Q: Does preview affect analytics?
**A:** Not by default. Preview happens on client-side. Add analytics calls explicitly:
```typescript
checkAuthRequired(message) {
  analytics.event('preview_limit_reached', { feature });
}
```

---

## Troubleshooting Questions

### Q: Auth modal doesn't appear
**A:** Check:
- `<FeaturePreviewProvider>` in App.tsx
- `<FeaturePreviewAuthModal />` in App.tsx
- Feature name in type definition matches usage
- `checkAuthRequired()` called before action

### Q: Preview banner shows for logged-in users
**A:** Check guard condition:
```tsx
// ✅ Correct
{!user && isPreviewAvailable && <Alert>...}

// ❌ Wrong
{isPreviewAvailable && <Alert>...}
```

### Q: localStorage still shows feature as accessed after login
**A:** This shouldn't happen. Check that:
- Hook is properly subscribed to auth changes
- `resetFeatureAccess()` is being called
- Component re-renders after login
- Try force refresh

### Q: User can access feature multiple times in preview
**A:** Check:
- `checkAuthRequired()` is being called
- Feature name matches exactly (case-sensitive!)
- localStorage key is correct: `stem_genius_preview_features`
- DevTools → Application → LocalStorage to verify

### Q: Data still saving for preview users
**A:** Wrap all saves with `if (user)`:
```typescript
// ✅ Correct
if (user) {
  await supabase.from("table").insert({ user_id: user.id, ... });
}

// ❌ Wrong
await supabase.from("table").insert({ ... });
```

---

## Performance Questions

### Q: Does preview impact performance?
**A:** Minimal:
- localStorage read: ~1ms
- Context provider: minimal overhead
- One modal component: light
- No network calls

### Q: Should I lazy load the modal?
**A:** Not necessary. Modal is simple and lightweight. Load it unconditionally.

### Q: Does preview add bundle size?
**A:** ~3KB gzipped:
- Context: ~1KB
- Hook: ~1KB
- Modal: ~1KB
- Total: negligible impact

---

## Security Questions

### Q: Is preview secure?
**A:** It's not a security feature - it's a UX feature. Assumes:
- Users can't access protected endpoints without auth
- Database requires user_id for saves
- localStorage isn't sensitive (client-side data)

### Q: Can users cheat by editing localStorage?
**A:** Users can "unlock" preview again by editing localStorage, but:
- They still can't save data without auth
- No API access without authentication
- This is expected behavior

### Q: Should I validate preview state on server?
**A:** You could, but it's not necessary:
- Preview state is client-side only
- Real protection is auth + database
- Server-side validation adds complexity

---

## Future/Roadmap Questions

### Q: Can I integrate preview with analytics?
**A:** Yes! Add tracking:
```typescript
// In useFeatureAuth.ts
checkAuthRequired() {
  mixpanel.track('preview_limit_reached');
  requireAuth(message);
}
```

### Q: Can I extend preview to premium features?
**A:** Yes! Modify `PreviewableFeature`:
```typescript
export type PreviewableFeature = 
  | "voice_tutor"
  | "premium_homework_solver";
```

### Q: Can I add preview tiers (try twice instead of once)?
**A:** Yes! Modify context:
```typescript
interface FeatureState {
  accessed: number; // Count instead of boolean
  maxTries: number;
}

canAccess = state.accessed < state.maxTries
```

### Q: Can I add preview expiration (try for 24 hours)?
**A:** Yes! Store timestamp in localStorage:
```typescript
{
  feature: "voice_tutor",
  accessedAt: timestamp,
  expiresIn: 86400000 // 24 hours
}
```

---

## Questions Not Covered?

**See documentation files:**
- `FEATURE_PREVIEW_SYSTEM.md` - Complete guide
- `QUICK_INTEGRATION_GUIDE.md` - Integration steps
- `ARCHITECTURE_DIAGRAMS.md` - System design
- Code comments in source files

**Or check:**
- `src/hooks/useFeatureAuth.ts` - Hook implementation
- `src/contexts/FeaturePreviewContext.tsx` - Context implementation
- `src/pages/VoiceStemTutor.tsx` - Integration example

