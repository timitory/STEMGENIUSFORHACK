
-- Product images table for multiple images per product
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Authors can manage product images" ON public.product_images FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.books WHERE books.id = product_images.book_id AND books.author_id = auth.uid()));
CREATE POLICY "Authors can delete product images" ON public.product_images FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.books WHERE books.id = product_images.book_id AND books.author_id = auth.uid()));

-- Order messages table for buyer-seller chat
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.book_purchases(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and seller can view messages" ON public.order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.book_purchases bp
      JOIN public.books b ON b.id = bp.book_id
      WHERE bp.id = order_messages.purchase_id
      AND (bp.buyer_id = auth.uid() OR b.author_id = auth.uid())
    )
  );

CREATE POLICY "Buyer and seller can send messages" ON public.order_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.book_purchases bp
      JOIN public.books b ON b.id = bp.book_id
      WHERE bp.id = order_messages.purchase_id
      AND (bp.buyer_id = auth.uid() OR b.author_id = auth.uid())
    )
  );

-- Seller notifications table
CREATE TABLE public.seller_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  purchase_id uuid NOT NULL REFERENCES public.book_purchases(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'new_order',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their notifications" ON public.seller_notifications FOR SELECT
  USING (auth.uid() = seller_id);
CREATE POLICY "System can create notifications" ON public.seller_notifications FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Sellers can mark as read" ON public.seller_notifications FOR UPDATE
  USING (auth.uid() = seller_id);

-- Enable realtime for order messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_notifications;
