import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { fetchListing, parseAppStoreLink } from "@/lib/ingest/appstore";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { preparePack } from "@/trigger/pipelines";

const Body = z.object({ link: z.string() });

/** Create a pack from an App Store link and start the prepare run. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing link" }, { status: 400 });

  const link = parseAppStoreLink(parsed.data.link);
  if (!link) return NextResponse.json({ error: "That doesn't look like an App Store link" }, { status: 400 });

  let listing;
  try {
    listing = await fetchListing(link);
  } catch {
    return NextResponse.json({ error: "Couldn't find that app on the App Store" }, { status: 404 });
  }

  const db = supabaseAdmin();
  const { data: app, error: appError } = await db
    .from("apps")
    .upsert(
      {
        user_id: user.id,
        store: "apple",
        store_id: link.storeId,
        country: link.country,
        name: listing.name,
        icon_url: listing.icon_url,
        listing_json: listing,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,store,store_id,country" },
    )
    .select("id")
    .single();
  if (appError) return NextResponse.json({ error: appError.message }, { status: 500 });

  const { data: pack, error: packError } = await db
    .from("packs")
    .insert({
      app_id: app.id,
      price_pence: env().PACK_PRICE_PENCE,
      cost_budget_pence: env().PACK_COST_BUDGET_PENCE,
    })
    .select("id")
    .single();
  if (packError) return NextResponse.json({ error: packError.message }, { status: 500 });

  await tasks.trigger<typeof preparePack>("prepare-pack", { packId: pack.id });
  return NextResponse.json({ packId: pack.id });
}
