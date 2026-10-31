CREATE POLICY "Users can update their own conversions"
ON public.pdf_conversions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);