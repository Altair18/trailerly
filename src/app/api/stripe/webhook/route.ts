import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { renderFinal } from "@/trigger/pipelines";

/** Payment confirmed -> record it, mark the pack paid and start the final render. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const packId = session.metadata?.packId;
    // Delayed payment methods complete the session unpaid and confirm later with async_payment_succeeded.
    if (packId && session.payment_status === "paid") {
      const db = supabaseAdmin();
      // Stripe delivers at least once, and both events can arrive for one session. Every step here is safe to
      // repeat: the payment row is unique per session, the status only moves draft -> paid, and the render is keyed
      // on the session, so a redelivery after a failed trigger starts it while a duplicate does nothing.
      const { error } = await db
        .from("payments")
        .upsert(
          { pack_id: packId, stripe_session_id: session.id, amount_pence: session.amount_total ?? 0, status: session.payment_status },
          { onConflict: "stripe_session_id", ignoreDuplicates: true },
        );
      // A failed write returns 500 so Stripe delivers the event again.
      if (error) return NextResponse.json({ error: "Couldn't record the payment" }, { status: 500 });
      const { error: statusError } = await db.from("packs").update({ status: "paid" }).eq("id", packId).eq("status", "draft");
      if (statusError) return NextResponse.json({ error: "Couldn't mark the pack paid" }, { status: 500 });
      await tasks.trigger<typeof renderFinal>("render-final", { packId }, { idempotencyKey: `final-${session.id}`, idempotencyKeyTTL: "30d" });
    }
  }
  return NextResponse.json({ received: true });
}
