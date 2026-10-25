import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { ownedPack } from "@/lib/owned";
import { appScreenshots } from "@/lib/media/screenshots";
import { readyClips } from "@/lib/packs";
import { Listing } from "@/lib/schemas/listing";
import { ChosenHooks } from "@/lib/schemas/hooks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { draftSpecsFor } from "@/lib/specs/outputs";
import { variantHooks } from "@/lib/timeline/variants";
import type { Hook } from "@/lib/schemas/hooks";
import type { renderDrafts } from "@/trigger/pipelines";

/** Start (or restart) the drafts run once the brief, picks and recording are all in. */
export async function POST(_req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.stage !== "review") return NextResponse.json({ error: "The brief isn't ready yet." }, { status: 409 });

  const chosen = ChosenHooks.safeParse(pack.chosen_hooks);
  if (!chosen.success || !chosen.data.headline) {
    return NextResponse.json({ error: "Pick a headline first." }, { status: 409 });
  }
  if ((await readyClips(pack.id)).length === 0) {
    // No recording: drafts can still be made from the App Store screenshots.
    const { data: app } = await supabaseAdmin().from("apps").select("listing_json").eq("id", pack.app_id).single();
    const listing = Listing.safeParse(app?.listing_json);
    if (appScreenshots(listing.success ? listing.data : null).length === 0) {
      return NextResponse.json({ error: "Add a screen recording first." }, { status: 409 });
    }
  }

  const specs = draftSpecsFor(variantHooks(chosen.data, (pack.hooks_json ?? []) as Hook[]));
  const db = supabaseAdmin();
  // Drop outputs this run won't make (say a variant whose hook was unpicked) so the page doesn't wait on them.
  await db.from("outputs").delete().eq("pack_id", pack.id).not("spec", "in", `(${specs.join(",")})`);
  await db
    .from("outputs")
    .upsert(specs.map((spec) => ({ pack_id: pack.id, spec, status: "queued" as const, error: null })), { onConflict: "pack_id,spec" });
  await tasks.trigger<typeof renderDrafts>("render-drafts", { packId: pack.id });
  return NextResponse.json({ ok: true });
}
