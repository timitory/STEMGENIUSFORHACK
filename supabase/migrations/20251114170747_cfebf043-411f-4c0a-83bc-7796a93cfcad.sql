-- Create books table
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  pdf_url TEXT,
  video_url TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  downloads_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0
);

-- Create book purchases table
CREATE TABLE public.book_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_price DECIMAL(10,2) NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(book_id, buyer_id)
);

-- Create career assessments table
CREATE TABLE public.career_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interests TEXT[],
  skills TEXT[],
  education_level TEXT,
  location TEXT,
  career_goals TEXT,
  ai_recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for books
CREATE POLICY "Anyone can view published books"
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY "Authors can create their own books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own books"
  ON public.books FOR DELETE
  USING (auth.uid() = author_id);

-- RLS Policies for book purchases
CREATE POLICY "Users can view their own purchases"
  ON public.book_purchases FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Users can create purchases"
  ON public.book_purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- RLS Policies for career assessments
CREATE POLICY "Users can view their own assessments"
  ON public.career_assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assessments"
  ON public.career_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('book-covers', 'book-covers', true),
  ('book-pdfs', 'book-pdfs', false),
  ('book-videos', 'book-videos', true);

-- Storage policies for book covers
CREATE POLICY "Anyone can view book covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');

CREATE POLICY "Authors can upload book covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'book-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authors can update their book covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'book-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for book PDFs
CREATE POLICY "Users can view PDFs they purchased or authored"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'book-pdfs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM public.book_purchases bp
        JOIN public.books b ON b.id = bp.book_id
        WHERE bp.buyer_id = auth.uid() AND b.pdf_url = name
      )
    )
  );

CREATE POLICY "Authors can upload book PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'book-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for book videos
CREATE POLICY "Anyone can view book videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-videos');

CREATE POLICY "Authors can upload book videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'book-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to increment book views
CREATE OR REPLACE FUNCTION public.increment_book_views(book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.books
  SET views_count = views_count + 1
  WHERE id = book_id;
END;
$$;

-- Create function to increment book downloads
CREATE OR REPLACE FUNCTION public.increment_book_downloads(book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.books
  SET downloads_count = downloads_count + 1
  WHERE id = book_id;
END;
$$;