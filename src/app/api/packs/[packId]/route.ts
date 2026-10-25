import { NextResponse } from "next/server";
import { z } from "zod";
import { validateChosen } from "@/lib/hooks";
import { Brief } from "@/lib/schemas/brief";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type Params = { params: Promise<{ packId: string }> };

/** Load a pack the signed-in user owns (RLS does the ownership check). */
async function ownedPack(packId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("packs")
    .select("id, status, stage, stage_error, brief_json, hooks_json, chosen_hooks, app_id")
    .eq("id", packId)
    .maybeSingle();
  if (!data) return null;
  const { data: app } = await supabase.from("apps").select("name, icon_url").eq("id", data.app_id).single();
  return { ...data, app };
}

/** Pack state for the UI to poll. The web app never waits on a model. */
export async function GET(_req: Request, { params }: Params) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pack);
}

const Patch = z.union([
  z.object({ brief: Brief }),
  z.object({ chosen: ChosenHooks }),
]);

/** Save the user's brief edits or hook picks. */
export async function PATCH(req: Request, { params }: Params) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.stage !== "review") return NextResponse.json({ error: "Pack isn't ready for review yet" }, { status: 409 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });

  const db = supabaseAdmin();
  if ("brief" in parsed.data) {
    const { error } = await db.from("packs").update({ brief_json: parsed.data.brief }).eq("id", pack.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const problem = validateChosen(parsed.data.chosen, (pack.hooks_json ?? []) as Hook[]);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const { error } = await db.from("packs").update({ chosen_hooks: parsed.data.chosen }).eq("id", pack.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
