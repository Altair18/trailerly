import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { ownedPack } from "@/lib/owned";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { prepareRecording } from "@/trigger/02-prepare-recording";

/** The browser finished uploading: start recording prep. */
export async function POST(_req: Request, { params }: { params: Promise<{ packId: string; sourceId: string }> }) {
  const { packId, sourceId } = await params;
  const pack = await ownedPack(packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: source } = await db.from("sources").select("id, status").eq("id", sourceId).eq("pack_id", pack.id).maybeSingle();
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.status !== "uploading") return NextResponse.json({ ok: true });

  await db.from("sources").update({ status: "preparing" }).eq("id", source.id);
  await tasks.trigger<typeof prepareRecording>("prepare-recording", { packId: pack.id, sourceId: source.id });
  return NextResponse.json({ ok: true });
}
