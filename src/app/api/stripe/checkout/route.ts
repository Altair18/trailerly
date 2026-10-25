import { NextResponse } from "next/server";
import { z } from "zod";
import { env, requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";

const Body = z.object({ packId: z.string().uuid() });

/** One-off Stripe Checkout per pack. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing packId" }, { status: 400 });
  const { packId } = parsed.data;

  // TODO(M6): check the pack belongs to the user and every output passes the rules.
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: requireEnv("STRIPE_PRICE_ID_PACK"), quantity: 1 }],
    metadata: { packId },
    success_url: `${env().NEXT_PUBLIC_APP_URL}/packs/${packId}?paid=1`,
    cancel_url: `${env().NEXT_PUBLIC_APP_URL}/packs/${packId}`,
  });
  return NextResponse.json({ url: session.url });
}
