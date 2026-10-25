import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import type { renderFinal } from "@/trigger/pipelines";

/** Payment confirmed -> mark the pack paid and start the final render. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const packId = event.data.object.metadata?.packId;
    if (packId) {
      // TODO(M6): insert `payments`, set packs.status = 'paid' (idempotent on stripe_session_id).
      await tasks.trigger<typeof renderFinal>("render-final", { packId });
    }
  }
  return NextResponse.json({ received: true });
}
