# ⚠️ ACTION REQUIRED: Apply Database Migration

## Error Encountered
```
PGRST204: Could not find the 'is_timed' column of 'quizzes' in the schema cache
```

## Root Cause
The timing columns (`is_timed`, `time_per_question`, `total_time`) don't exist in your Supabase `quizzes` table yet.

## Solution: Apply the Migration

### **QUICK FIX (Recommended - 2 minutes)**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in left sidebar
   - Click "New Query" button

3. **Copy This SQL:**
```sql
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_timed boolean DEFAULT true;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS time_per_question integer DEFAULT 30;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS total_time integer DEFAULT 300;

COMMENT ON COLUMN public.quizzes.is_timed IS 'Whether this quiz has time limits (true) or is untimed (false)';
COMMENT ON COLUMN public.quizzes.time_per_question IS 'Seconds allocated per question (nullable if untimed)';
COMMENT ON COLUMN public.quizzes.total_time IS 'Total seconds for entire quiz (nullable if untimed)';
```

4. **Paste into SQL Editor**
   - Click in the query box
   - Paste the SQL above
   - Click "Run" button (blue button, top right)

5. **Verify Success**
   - You should see "Success" message
   - No errors should appear

6. **Refresh App**
   - Return to your app
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Try creating a quiz again

---

## What Gets Added

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_timed` | boolean | true | Quiz has time limits |
| `time_per_question` | integer | 30 | Seconds per question |
| `total_time` | integer | 300 | Total quiz seconds (5 min) |

---

## Verification Query

Run this to confirm the migration worked:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'quizzes' 
AND column_name IN ('is_timed', 'time_per_question', 'total_time');
```

Expected output: 3 rows with the 3 new columns ✅

---

## Files Created

- `supabase/migrations/20260527_add_timing_to_quizzes.sql` - Migration file
- `APPLY_TIMING_MIGRATION.md` - Detailed instructions

---

## After Migration

Once applied, you can:
✅ Create timed quizzes in STEM Challenge Arena
✅ Set custom time per question
✅ Set custom total quiz time
✅ Toggle between timed/untimed mode
✅ All new settings saved to database

---

**Need Help?**
If you encounter any issues:
1. Check that you're in the correct Supabase project
2. Verify the SQL is copied exactly (no extra spaces)
3. Check the error message for details
4. The migration file is at: `supabase/migrations/20260527_add_timing_to_quizzes.sql`
