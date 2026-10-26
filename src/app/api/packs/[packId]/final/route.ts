import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { ownedPack } from "@/lib/owned";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { renderFinal } from "@/trigger/pipelines";

/** Run the full-size renders again after a failed final run. Only for packs with a recorded payment. */
export async function POST(_req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.status !== "failed") return NextResponse.json({ error: "Nothing to retry." }, { status: 409 });

  const db = supabaseAdmin();
  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("pack_id", pack.id);
  if (!count) return NextResponse.json({ error: "No payment found for this pack." }, { status: 402 });

  // Claim the retry by moving failed -> paid, so a double click starts one run, not two.
  const { data: claimed } = await db.from("packs").update({ status: "paid" }).eq("id", pack.id).eq("status", "failed").select("id");
  if (!claimed?.length) return NextResponse.json({ ok: true });
  await tasks.trigger<typeof renderFinal>("render-final", { packId: pack.id });
  return NextResponse.json({ ok: true });
}
