
DROP POLICY "System can create notifications" ON public.seller_notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.seller_notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.book_purchases bp
      WHERE bp.id = seller_notifications.purchase_id
      AND bp.buyer_id = auth.uid()
    )
  );
