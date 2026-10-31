
-- Add is_approved column to books table (default false for new uploads)
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Update existing books to be approved (they were already published)
UPDATE public.books SET is_approved = true;

-- Drop the existing public SELECT policy and replace with one that filters by is_approved
DROP POLICY IF EXISTS "Anyone can view published books" ON public.books;

CREATE POLICY "Anyone can view approved books"
ON public.books
FOR SELECT
TO authenticated, anon
USING (is_approved = true OR auth.uid() = author_id);

-- Allow admins to update books (already exists but ensure it covers approval)
