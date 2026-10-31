# How to Apply the Timing Columns Migration

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the SQL below
6. Click **Run**

## Option 2: Using Supabase CLI

```bash
supabase db push
```

## SQL to Execute

```sql
-- Add timing columns to quizzes table
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_timed boolean DEFAULT true;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS time_per_question integer DEFAULT 30;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS total_time integer DEFAULT 300;

-- Add helpful comments
COMMENT ON COLUMN public.quizzes.is_timed IS 'Whether this quiz has time limits (true) or is untimed (false)';
COMMENT ON COLUMN public.quizzes.time_per_question IS 'Seconds allocated per question (nullable if untimed)';
COMMENT ON COLUMN public.quizzes.total_time IS 'Total seconds for entire quiz (nullable if untimed)';
```

## What This Does

- Adds `is_timed` column (boolean, default: true)
- Adds `time_per_question` column (integer seconds, default: 30)
- Adds `total_time` column (integer seconds, default: 300)
- Adds helpful comments explaining each column

## Verification

After running, verify the columns were added:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'quizzes' 
AND column_name IN ('is_timed', 'time_per_question', 'total_time');
```

You should see 3 rows returned.

## Next Steps

1. Refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Try creating a quiz in STEM Challenge Arena with timing controls
3. The timing controls should now work properly
