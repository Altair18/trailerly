import { NextResponse } from "next/server";
import { z } from "zod";
import { env, requireEnv } from "@/lib/env";
import { ownedPack } from "@/lib/owned";
import { checkoutProblem } from "@/lib/payment";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { draftSpecsFor } from "@/lib/specs/outputs";
import { checkoutOpen, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { variantHooks } from "@/lib/timeline/variants";

const Body = z.object({ packId: z.string().uuid() });

/** One-off Stripe Checkout per pack, open once every draft is ready and passes the store rules. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing packId" }, { status: 400 });

  const pack = await ownedPack(parsed.data.packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!checkoutOpen()) return NextResponse.json({ error: "Checkout isn't open yet." }, { status: 503 });

  const chosen = ChosenHooks.safeParse(pack.chosen_hooks);
  const specs = draftSpecsFor(chosen.success ? variantHooks(chosen.data, (pack.hooks_json ?? []) as Hook[]) : []);
  const { data: outputs } = await supabaseAdmin().from("outputs").select("spec, status, rules_status").eq("pack_id", pack.id);
  const problem = checkoutProblem(pack.status, outputs ?? [], specs);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  const back = `${env().NEXT_PUBLIC_APP_URL}/packs/${pack.id}/drafts`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: requireEnv("STRIPE_PRICE_ID_PACK"), quantity: 1 }],
    metadata: { packId: pack.id },
    client_reference_id: pack.id,
    success_url: `${back}?paid=1`,
    cancel_url: back,
  });
  return NextResponse.json({ url: session.url });
}

