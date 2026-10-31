/**
 * create-tutor-checkout
 *
 * Creates a Stripe Checkout session for a paid tutor booking.
 * Called by the frontend when a student books a paid tutoring session.
 *
 * ⚠️  Nigerian marketplace note:
 * Stripe does not currently support NGN as a settlement currency for Nigerian
 * businesses. This function charges in USD (converted from NGN) to the student's
 * card and credits the platform account. Tutor payouts must currently be
 * handled separately (e.g. via bank transfer, Paystack, or Flutterwave).
 * Do NOT activate live payments until this limitation is confirmed acceptable.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NGN_TO_USD_RATE = 1600; // Approximate rate — update regularly or use a live FX API
const MIN_STRIPE_AMOUNT_USD = 0.5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // ── 1. Authenticate the requesting user ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("User not authenticated");

    // ── 2. Parse and validate request body ───────────────────────────────
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("bookingId is required");

    // ── 3. Fetch the booking (service role, bypass RLS) ──────────────────
    const { data: booking, error: bookingError } = await serviceClient
      .from("tutor_bookings")
      .select(
        `*,
         tutor_profiles (
           id,
           hourly_rate,
           user_id,
           profiles:user_id (name)
         )`
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    // Security: only the student who created the booking can pay for it
    if (booking.student_id !== user.id) {
      throw new Error("Unauthorised: this booking does not belong to you");
    }

    // Prevent double-payment
    if (booking.payment_status === "paid") {
      throw new Error("This booking has already been paid");
    }
    if (booking.status === "cancelled") {
      throw new Error("This booking has been cancelled and cannot be paid");
    }
    if (booking.is_free) {
      throw new Error("This is a free session and does not require payment");
    }

    const amountNGN = booking.amount_paid ?? 0;
    if (amountNGN <= 0) {
      throw new Error("Invalid booking amount");
    }

    // ── 4. Convert to USD and create Stripe session ──────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const amountUSD = Math.max(amountNGN / NGN_TO_USD_RATE, MIN_STRIPE_AMOUNT_USD);
    const amountCents = Math.round(amountUSD * 100);

    // Reuse or create Stripe customer
    const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = existingCustomers.data[0]?.id;

    const tutorName =
      (booking.tutor_profiles as any)?.profiles?.name || "Your Tutor";
    const sessionLabel = `${booking.duration_minutes}-min ${booking.subject} session with ${tutorName}`;

    const origin = req.headers.get("origin") || "https://stemgenius.netlify.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: sessionLabel,
              description: `Booking ref: ${booking.booking_reference} | ₦${amountNGN.toLocaleString()} (charged in USD)`,
              metadata: {
                booking_id: bookingId,
                booking_reference: booking.booking_reference,
                original_ngn: amountNGN.toString(),
              },
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/tutoring/booking/${bookingId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tutoring/booking/${bookingId}?payment=cancelled`,
      metadata: {
        booking_id: bookingId,
        student_id: user.id,
        booking_reference: booking.booking_reference,
      },
      // Expire the session after 30 minutes to prevent stale payments
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    // ── 5. Record the pending Stripe session ID against the booking ───────
    await serviceClient
      .from("tutor_bookings")
      .update({
        payment_reference: session.id,
        payment_status: "pending",
      })
      .eq("id", bookingId);

    console.log(`Stripe tutor checkout created: ${session.id} for booking ${bookingId}`);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("create-tutor-checkout error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

