CREATE POLICY "Users can view free book PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'book-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.pdf_url = objects.name
    AND b.is_free = true
  )
);