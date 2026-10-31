-- Add new columns to books table to support different product types and delivery
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'book' CHECK (product_type IN ('book', 'video', 'academic_material')),
ADD COLUMN IF NOT EXISTS book_type text CHECK (book_type IN ('digital', 'paperback')),
ADD COLUMN IF NOT EXISTS requires_delivery boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_product_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Update existing books to have digital book type
UPDATE public.books SET book_type = 'digital' WHERE book_type IS NULL;

-- Make book_type not nullable after setting defaults
ALTER TABLE public.books ALTER COLUMN book_type SET NOT NULL;

-- Add delivery address fields to book_purchases
ALTER TABLE public.book_purchases
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_city text,
ADD COLUMN IF NOT EXISTS delivery_state text,
ADD COLUMN IF NOT EXISTS delivery_phone text,
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('pending', 'processing', 'shipped', 'delivered'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_books_product_type ON public.books(product_type);
CREATE INDEX IF NOT EXISTS idx_books_book_type ON public.books(book_type);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON public.book_purchases(payment_status);