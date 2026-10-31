CREATE POLICY "Anyone can view profiles publicly"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);