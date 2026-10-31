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

  // Use anon key for auth validation
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  // Use service role for DB writes (bypasses RLS)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await anonClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { bookId, deliveryInfo } = await req.json();

    // Get book details
    const { data: book, error: bookError } = await serviceClient
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (bookError || !book) throw new Error("Book not found");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate total amount in NGN
    const productPrice = book.price;
    const deliveryFee = book.requires_delivery && deliveryInfo ? book.delivery_fee : 0;
    const totalAmountNGN = productPrice + deliveryFee;

    // Convert NGN to USD (approximate rate: 1 USD = 1420 NGN)
    // This ensures we meet Stripe's minimum $0.50 requirement
    const exchangeRate = 1420; // NGN to USD
    const totalAmountUSD = Math.max(totalAmountNGN / exchangeRate, 0.50); // Minimum $0.50

    // Create Stripe product and price in USD
    const product = await stripe.products.create({
      name: book.title,
      description: book.description || "",
      metadata: {
        book_id: bookId,
        product_type: book.product_type,
        original_price_ngn: totalAmountNGN.toString(),
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(totalAmountUSD * 100), // Convert to cents
      currency: "usd",
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/marketplace/book/${bookId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/marketplace/book/${bookId}?payment=cancelled`,
      metadata: {
        book_id: bookId,
        buyer_id: user.id,
      },
    });

    // Create pending purchase record using service role
    const { error: insertError } = await serviceClient
      .from("book_purchases")
      .insert({
        book_id: bookId,
        buyer_id: user.id,
        purchase_price: totalAmountNGN,
        delivery_address: deliveryInfo?.address || null,
        delivery_city: deliveryInfo?.city || null,
        delivery_state: deliveryInfo?.state || null,
        delivery_phone: deliveryInfo?.phone || null,
        delivery_fee: deliveryFee,
        payment_status: "pending",
        stripe_payment_intent_id: session.id,
        delivery_status: book.requires_delivery ? "pending" : null,
      });

    if (insertError) {
      console.error("Error creating purchase record:", insertError);
      throw new Error("Failed to create purchase record");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
