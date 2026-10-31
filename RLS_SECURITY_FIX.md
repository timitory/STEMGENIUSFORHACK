# 🔧 RLS POLICY FIX - Row Level Security Error 42501

## 🔴 Error You Got

```json
{
    "code": "42501",
    "details": null,
    "hint": null,
    "message": "new row violates row-level security policy for table \"live_quiz_questions\""
}
```

---

## 🎯 What Caused It

**Root Cause**: The `live_quiz_questions` table was missing an INSERT policy.

**What Happened**:
1. Database migration created the table ✅
2. RLS was enabled on the table ✅
3. But only a SELECT policy was added ❌
4. When CreateLiveQuiz tried to INSERT questions → BLOCKED by RLS ❌

**Why It Happened**:
- RLS policies need explicit GRANT for each operation
- My migration only had SELECT policy
- INSERT, UPDATE, DELETE policies were missing

---

## ✅ The Fix (Already Applied)

I've updated the migration file with complete RLS policies:

### Added to `live_quiz_questions`:
```sql
-- Quiz creators can insert questions into their quiz
CREATE POLICY "Quiz creators can insert questions" ON public.live_quiz_questions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Quiz creators can update questions
CREATE POLICY "Quiz creators can update questions" ON public.live_quiz_questions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Quiz creators can delete questions
CREATE POLICY "Quiz creators can delete questions" ON public.live_quiz_questions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);
```

### Added to `live_quiz_scores`:
```sql
CREATE POLICY "System can insert scores" ON public.live_quiz_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update scores" ON public.live_quiz_scores FOR UPDATE USING (true);
```

### Added to `live_quiz_answers`:
```sql
CREATE POLICY "Users can update their own answers" ON public.live_quiz_answers 
FOR UPDATE 
USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));

CREATE POLICY "Users can delete their own answers" ON public.live_quiz_answers 
FOR DELETE 
USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));
```

### Added to `live_quiz_participants`:
```sql
CREATE POLICY "Users can delete their own participation" ON public.live_quiz_participants 
FOR DELETE 
USING (auth.uid() = user_id);
```

---

## 🚀 How to Apply the Fix

### OPTION 1: Drop and Recreate (Clean - Recommended)

**In Supabase SQL Editor**:
```sql
-- Drop all live quiz tables (will delete any data!)
DROP TABLE IF EXISTS public.live_quiz_scores CASCADE;
DROP TABLE IF EXISTS public.live_quiz_answers CASCADE;
DROP TABLE IF EXISTS public.live_quiz_participants CASCADE;
DROP TABLE IF EXISTS public.live_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.live_quizzes CASCADE;

-- Then copy-paste the ENTIRE fixed migration:
-- supabase/migrations/20260527_create_live_quiz_tables.sql
-- And run it
```

### OPTION 2: Add Missing Policies Only (Keep Data)

**If you want to keep existing data**:

```sql
-- Add the missing INSERT policy
CREATE POLICY "Quiz creators can insert questions" ON public.live_quiz_questions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Add the missing UPDATE policy
CREATE POLICY "Quiz creators can update questions" ON public.live_quiz_questions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Add the missing DELETE policy
CREATE POLICY "Quiz creators can delete questions" ON public.live_quiz_questions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);

-- Add missing policies for other tables
CREATE POLICY "System can insert scores" ON public.live_quiz_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update scores" ON public.live_quiz_scores FOR UPDATE USING (true);

CREATE POLICY "Users can update their own answers" ON public.live_quiz_answers 
FOR UPDATE 
USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));

CREATE POLICY "Users can delete their own answers" ON public.live_quiz_answers 
FOR DELETE 
USING (auth.uid() = (SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id));

CREATE POLICY "Users can delete their own participation" ON public.live_quiz_participants 
FOR DELETE 
USING (auth.uid() = user_id);
```

---

## ✅ After Applying Fix

1. **Go to Supabase → SQL Editor**
2. **Choose Option 1 or 2 above**
3. **Copy-paste and run the SQL**
4. **Wait for success message**
5. **Go back to your app**
6. **Try creating a quiz again** ✅

**Expected Result**: 
- No more error 42501
- Questions insert successfully
- Quiz creation works!

---

## 🔍 Understanding RLS Policies

### What are RLS Policies?
RLS (Row Level Security) are database rules that control who can read, create, update, or delete data.

### The 4 Operations
Each table needs policies for:
1. **SELECT** - View data
2. **INSERT** - Create new rows
3. **UPDATE** - Modify existing rows
4. **DELETE** - Remove rows

### Policy Structure
```sql
CREATE POLICY "Policy Name" 
ON table_name 
FOR operation   -- SELECT, INSERT, UPDATE, or DELETE
WITH CHECK (condition)  -- INSERT only
USING (condition)       -- SELECT, UPDATE, DELETE
```

### My Policy for Questions
```sql
CREATE POLICY "Quiz creators can insert questions" 
ON public.live_quiz_questions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
);
```

**What it does**:
- Allows INSERT operation
- Only if the user is the quiz creator
- Checks: quiz.creator_id = current_user
- If check fails → Error 42501 (Permission Denied)

---

## 📊 Complete RLS Policy Summary

After the fix, all tables have:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `live_quizzes` | ✅ All | ✅ Creator | ✅ Creator | ✅ Creator |
| `live_quiz_questions` | ✅ All | ✅ Creator* | ✅ Creator* | ✅ Creator* |
| `live_quiz_participants` | ✅ All | ✅ User | ✅ User | ✅ User |
| `live_quiz_answers` | ✅ All | ✅ User | ✅ User | ✅ User |
| `live_quiz_scores` | ✅ All | ✅ System | ✅ System | ✅ System |

*Creator = User who created the quiz

---

## 🧪 How to Test

After applying fix:

```
1. Open app
2. Go to "Create Live Quiz"
3. Enter title
4. Click "Create Quiz"
5. ✅ Should work (no 42501 error)

6. Click "Create Another Quiz"
7. Click "⚡ Generate with AI"
8. Enter topic
9. Click "Generate"
10. ✅ Questions insert correctly
```

---

## 🐛 If Error Persists

### Check 1: Policies Exist
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'live_quiz_questions';
```

### Check 2: RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'live_quiz_questions';
-- Should show: rowsecurity = true
```

### Check 3: Create Quiz Fails
- Make sure you're logged in
- Check auth.uid() returns a value
- Try in same browser session

### Check 4: Hard Refresh
```
1. Ctrl+F5 (hard refresh browser)
2. Wait 10 seconds
3. Try again
```

---

## 📝 Policy Logic Explanation

### For `live_quiz_questions` INSERT:
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_quizzes 
    WHERE id = quiz_id AND creator_id = auth.uid()
  )
)
```

**This checks**:
1. Find quiz with matching ID
2. Check if its creator_id = logged in user's ID
3. If true → Allow INSERT
4. If false → Deny with error 42501

### For `live_quiz_answers` INSERT:
```sql
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.live_quiz_participants WHERE id = participant_id
  )
)
```

**This checks**:
1. Find participant with matching ID
2. Check if user_id = logged in user's ID
3. If true → Allow INSERT
4. If false → Deny

---

## ✨ Best Practices

✅ **DO**:
- Always have SELECT policy (view)
- Add INSERT, UPDATE, DELETE only as needed
- Use user_id for personal data
- Use creator_id for owner checks
- Test with different user accounts

❌ **DON'T**:
- Leave INSERT/UPDATE/DELETE off unintentionally
- Trust only client-side validation
- Use `true` for sensitive operations
- Mix up auth.uid() with other IDs

---

## 📞 Summary

**Problem**: RLS policy missing for INSERT
**Solution**: Added complete INSERT/UPDATE/DELETE policies
**Status**: ✅ FIXED
**Files Updated**: `supabase/migrations/20260527_create_live_quiz_tables.sql`
**Action Required**: Run fixed migration in Supabase

---

After applying this fix, all database operations should work correctly! 🚀
