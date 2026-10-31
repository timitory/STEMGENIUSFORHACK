import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // Update purchase record to completed
      const { data: purchase, error: updateError } = await serviceClient
        .from("book_purchases")
        .update({
          payment_status: "completed",
          stripe_payment_intent_id: (session.payment_intent as string) || sessionId,
        })
        .eq("stripe_payment_intent_id", sessionId)
        .select("*, books!book_purchases_book_id_fkey(author_id, requires_delivery)")
        .single();

      if (updateError) {
        console.error("Error updating purchase:", updateError);
      }

      // Send seller notification
      if (purchase) {
        const sellerId = (purchase as any).books?.author_id;
        if (sellerId) {
          await serviceClient.from("seller_notifications").insert({
            seller_id: sellerId,
            purchase_id: purchase.id,
            type: "new_order",
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, status: "paid", purchaseId: purchase?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, status: session.payment_status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
