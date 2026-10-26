import Stripe from "stripe";
import { env, requireEnv } from "@/lib/env";

let client: Stripe | undefined;

export function stripe(): Stripe {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}

/** Checkout needs the Stripe keys and the pack price set; until then the drafts page hides the pay button. */
export function checkoutOpen(): boolean {
  const e = env();
  return !!(e.STRIPE_SECRET_KEY && e.STRIPE_PRICE_ID_PACK && e.STRIPE_WEBHOOK_SECRET);
}
