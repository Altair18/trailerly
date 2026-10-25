import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { ownedPack } from "@/lib/owned";
import { readyClips } from "@/lib/packs";
import { ChosenHooks } from "@/lib/schemas/hooks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DRAFT_SPECS } from "@/lib/specs/outputs";
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
    return NextResponse.json({ error: "Add a screen recording first." }, { status: 409 });
  }

  await supabaseAdmin()
    .from("outputs")
    .upsert(DRAFT_SPECS.map((spec) => ({ pack_id: pack.id, spec, status: "queued" as const, error: null })), { onConflict: "pack_id,spec" });
  await tasks.trigger<typeof renderDrafts>("render-drafts", { packId: pack.id });
  return NextResponse.json({ ok: true });
}
