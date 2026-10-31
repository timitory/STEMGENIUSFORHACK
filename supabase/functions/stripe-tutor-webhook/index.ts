/**
 * stripe-tutor-webhook
 *
 * Handles Stripe webhook events for tutor booking payments.
 * Register this URL in your Stripe Dashboard → Webhooks.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_TUTOR_WEBHOOK_SECRET   ← separate signing secret from the book marketplace webhook
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Events handled:
 *   checkout.session.completed    → mark booking paid, update tutor wallet
 *   checkout.session.expired      → mark booking payment_status=failed
 *   charge.refunded               → mark booking refunded
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const WEBHOOK_SECRET = Deno.env.get("STRIPE_TUTOR_WEBHOOK_SECRET") || "";

  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_TUTOR_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  console.log(`Tutor webhook: received event type=${event.type}`);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only process tutor bookings (identified by booking_id in metadata)
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) {
        console.log("checkout.session.completed: no booking_id in metadata, skipping");
        return new Response("OK", { status: 200 });
      }

      if (session.payment_status !== "paid") {
        console.log(`checkout.session.completed: payment_status=${session.payment_status}, skipping`);
        return new Response("OK", { status: 200 });
      }

      // ── Mark booking as paid ───────────────────────────────────────────
      const { data: booking, error: updateError } = await serviceClient
        .from("tutor_bookings")
        .update({
          payment_status: "paid",
          status: "scheduled",
          payment_reference: (session.payment_intent as string) || session.id,
        })
        .eq("id", bookingId)
        .select("*, tutor_profiles(user_id, tutor_earnings)")
        .single();

      if (updateError) {
        console.error("Failed to update booking:", updateError);
        // Return 200 to prevent Stripe from retrying — log the error for manual review
        return new Response("OK", { status: 200 });
      }

      console.log(`Booking ${bookingId} marked as paid`);

      // ── Credit tutor wallet (pending balance until session completes) ──
      if (booking) {
        const tutorUserId = (booking as any).tutor_profiles?.user_id;
        const tutorEarnings = booking.tutor_earnings ?? 0;

        if (tutorUserId && tutorEarnings > 0) {
          const { error: walletError } = await serviceClient.rpc(
            "increment_tutor_pending_balance",
            { p_tutor_user_id: tutorUserId, p_amount: tutorEarnings }
          );
          if (walletError) {
            console.error("Failed to update tutor wallet:", walletError);
            // Non-fatal — the booking is confirmed; wallet can be corrected manually
          }
        }
      }
    }

    else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        await serviceClient
          .from("tutor_bookings")
          .update({ payment_status: "failed" })
          .eq("id", bookingId)
          .eq("payment_status", "pending"); // only update if still pending
        console.log(`Booking ${bookingId} checkout expired`);
      }
    }

    else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;
      if (paymentIntentId) {
        await serviceClient
          .from("tutor_bookings")
          .update({ payment_status: "refunded", status: "cancelled" })
          .eq("payment_reference", paymentIntentId);
        console.log(`Booking for payment ${paymentIntentId} marked refunded`);
      }
    }

    else {
      console.log(`Unhandled tutor webhook event: ${event.type}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error processing tutor webhook:", msg);
    // Return 200 so Stripe doesn't retry — errors should be investigated in logs
    return new Response("OK", { status: 200 });
  }
});

