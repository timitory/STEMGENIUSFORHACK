# Feature Preview System - Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ <FeaturePreviewProvider>                                 │  │
│  │  (Manages global preview state, localStorage, auth modal)│  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ <FeaturePreviewAuthModal />                        │  │  │
│  │  │ (Shows modal when auth needed)                     │  │  │
│  │  │ ┌──────────────────────────────────────────────┐  │  │  │
│  │  │ │ All Routes (Features, Pages, etc.)          │  │  │  │
│  │  │ │ ┌────────────────────────────────────────┐  │  │  │  │
│  │  │ │ │ VoiceStemTutor Page                   │  │  │  │  │
│  │  │ │ │ ├─ useFeatureAuth("voice_tutor")      │  │  │  │  │
│  │  │ │ │ └─ checkAuthRequired() on submit      │  │  │  │  │
│  │  │ │ │                                        │  │  │  │  │
│  │  │ │ │ STEMMarketplace Page                  │  │  │  │  │
│  │  │ │ │ ├─ useFeatureAuth("marketplace")      │  │  │  │  │
│  │  │ │ │ └─ Redirects on publish/dashboard     │  │  │  │  │
│  │  │ │ │                                        │  │  │  │  │
│  │  │ │ │ AIHomeworkHelper Page                 │  │  │  │  │
│  │  │ │ │ ├─ useFeatureAuth("homework_helper") │  │  │  │  │
│  │  │ │ │ └─ checkAuthRequired() on submit      │  │  │  │  │
│  │  │ │ │                                        │  │  │  │  │
│  │  │ │ │ STEMReels Page                        │  │  │  │  │
│  │  │ │ │ ├─ useFeatureAuth("stem_reels")      │  │  │  │  │
│  │  │ │ │ └─ Redirects on upload/interact      │  │  │  │  │
│  │  │ │ └────────────────────────────────────────┘  │  │  │  │
│  │  │ └──────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## User State Flow

```
START: New User, Not Logged In
│
├─ localStorage empty
└─ accessedFeatures = Set()

   ↓

VISIT FEATURE PAGE (e.g., Voice Tutor)
│
├─ useFeatureAuth("voice_tutor")
├─ isPreviewAvailable = true
└─ Show preview banner

   ↓

ATTEMPT ACTION (Ask Question)
│
├─ checkAuthRequired() called
├─ user = null (not logged in)
├─ isPreviewAvailable = true (first time)
├─ ✅ ACTION ALLOWED
├─ Mark feature as accessed
└─ localStorage["stem_genius_preview_features"] = ["voice_tutor"]

   ↓

ATTEMPT SECOND ACTION (Ask Another Question)
│
├─ checkAuthRequired() called
├─ user = null (still not logged in)
├─ isPreviewAvailable = false (already used)
├─ ❌ Show auth modal
└─ Await user response

   ↓

USER CHOOSES "SIGN UP"
│
├─ Modal closes
└─ Navigate to /auth?mode=signup

   ↓

USER LOGS IN SUCCESSFULLY
│
├─ Auth state updates
├─ useFeatureAuth detects login
├─ 🔄 RESET: localStorage cleared
├─ 🔄 RESET: accessedFeatures = Set()
└─ Preview access fully reset

   ↓

RETURN TO FEATURE PAGE
│
├─ isPreviewAvailable = true (reset!)
├─ user = {...} (logged in)
├─ ✅ UNLIMITED ACCESS
└─ All data saved to database

END: Fully Authenticated User
```

## Feature Preview State Machine

```
┌─────────────────────────────────────┐
│     PREVIEW NOT ACCESSED            │
│  (isPreviewAvailable = true)         │
│  (localStorage empty)                │
└─────────────────────────────────────┘
            │
            │ User attempts action
            ↓
┌─────────────────────────────────────┐
│  ALLOW ACTION (First Use)            │
│  (Mark feature as accessed)          │
│  (Save to localStorage)              │
└─────────────────────────────────────┘
            │
            │ User attempts second action
            ↓
     ┌──────────────────┐
     │ User Logged In?  │
     └──────────────────┘
          ↙        ↖
       YES          NO
        ↓            ↓
  ┌─────────┐   ┌──────────────────────┐
  │ ALLOW   │   │ SHOW AUTH MODAL       │
  │ (Full)  │   │ "Auth Required"       │
  └─────────┘   └──────────────────────┘
        │              │
        │              │ User logs in
        │              ↓
        │         ┌──────────────────┐
        └────────→│ RESET PREVIEW     │
                  │ (Clear localStorage)
                  │ Return to "NOT ACCESSED"
                  └──────────────────┘
```

## Data Flow: Preview Action

```
User Clicks Button
      ↓
Component calls checkAuthRequired()
      ↓
┌─────────────────────────┐
│ Check conditions:       │
│ - user exists?          │
│ - isPreviewAvailable?   │
└─────────────────────────┘
      ↓
    ┌─────────────────────┐
    │ What's the status?  │
    └─────────────────────┘
    ↙        ↙        ↖
  CASE 1   CASE 2    CASE 3
    ↓       ↓         ↓
 User   User &    Preview
Logged  Preview  Used
  In    Works

    ↓       ↓         ↓
  ✅      ✅       ⚠️ 
Allow   Allow    Show
Action  Action   Modal
          &
        Mark
      Accessed

        ↓       ↓         ↓
   Continue  Continue  Modal
   Process   Process   Closes
     &         &
   Save*    Show
           Result*

* = Only save to DB if user exists
```

## Authentication Modal Flow

```
checkAuthRequired() → Returns TRUE
        ↓
showAuthModal = true
authModalMessage = "Custom message"
        ↓
┌──────────────────────────────┐
│  FeaturePreviewAuthModal     │
│  ┌────────────────────────┐  │
│  │ Authentication Required │  │
│  │ {message}              │  │
│  │ [Log In] [Sign Up]     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
        ↙          ↖
    Clicked    Clicked
    Log In     Sign Up
        ↓          ↓
  navigate     navigate
  /auth        /auth
  ?mode=      ?mode=
  login       signup
        ↓          ↓
   Auth Page   Auth Page
   (Handles all auth logic)
```

## Feature Access Timeline

```
Time →

User Visit        |
Feature Access 1  |─────────────✅ Allowed
                  |
Feature Access 2  |─────────────⚠️ Blocked → Auth Modal
                  |
User Logs In      |─────────────🔄 Reset
                  |
Feature Access 1  |─────────────✅ Allowed (again)
Feature Access 2  |─────────────✅ Allowed
Feature Access 3  |─────────────✅ Allowed
...Unlimited...   |─────────────✅ Allowed
```

## Storage Structure

```
Browser localStorage
│
├─ Key: "stem_genius_preview_features"
│  Value: ["voice_tutor", "homework_helper"]
│  Type: JSON Array
│  Size: ~50 bytes
│  Persists: Yes (across sessions)
│  Cleared: On login
│
└─ Other app data...
   (Not affected by preview system)

Database (Supabase)
│
├─ voice_tutor_sessions
│  ├─ Only saved if user.id exists
│  ├─ Preview users: No entries
│  └─ Logged-in users: Full history
│
├─ homework_sessions
│  ├─ Only saved if user.id exists
│  ├─ Preview users: No entries
│  └─ Logged-in users: Full history
│
├─ reels
│  ├─ Only saved if user.id exists
│  ├─ Preview users: No uploads
│  └─ Logged-in users: Full uploads
│
└─ Other tables...
   (Not affected by preview system)
```

## Component Communication

```
┌──────────────────────────────┐
│  FeaturePreviewContext       │
│  (Global State Manager)      │
│  ├─ accessedFeatures: Set    │
│  ├─ showAuthModal: boolean   │
│  └─ authModalMessage: string │
└──────────────────────────────┘
      ↑                    ↓
      │                    │
 useFeatureAuth()    FeaturePreviewAuthModal
 (Hook)              (Component)
      ↑                    ↓
      │                    │
 ┌─────┴─────┬─────────────┬──────────┐
 ↓           ↓             ↓          ↓
Voice      Marketplace  Homework    Reels
Tutor      Component    Helper      Component
Page                    Page
(Consumes hook, (Renders modal,
 calls methods) handles user choice)
```

## Decision Tree: To Save or Not to Save

```
Action triggered
   ↓
Is user logged in?
├─ YES → ✅ Save to database
│         └─ user.id available
│            └─ Insert/Update record
│
└─ NO → Is this first feature access?
   ├─ YES → ✅ Allow action (PREVIEW)
   │        └─ Don't save to DB
   │        └─ Mark feature as accessed
   │        └─ localStorage updated
   │
   └─ NO → ❌ Block action
            └─ Show auth modal
            └─ User must login/signup
            └─ After login: RESET & retry
```

---

## Summary

The system uses a **context + hook + modal pattern** to:
1. Track preview feature access (localStorage)
2. Check auth requirements (useFeatureAuth hook)
3. Show auth UI (FeaturePreviewAuthModal)
4. Reset on login (auto-handled by hook)
5. Prevent database pollution (conditional saves)

All components communicate through context, making it easy to add preview support to any feature in 3 simple steps!
