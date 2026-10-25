import { NextResponse } from "next/server";
import { z } from "zod";
import { validateChosen } from "@/lib/hooks";
import { ownedPack } from "@/lib/owned";
import { Brief } from "@/lib/schemas/brief";
import { Clips } from "@/lib/schemas/clips";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { signedUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Params = { params: Promise<{ packId: string }> };

/** Pack state for the UI to poll: brief, hooks, recording and clips, outputs and rule results. */
export async function GET(_req: Request, { params }: Params) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: source } = await db
    .from("sources")
    .select("id, status, error, file_name, duration_s, clips_json")
    .eq("pack_id", pack.id)
    .eq("kind", "recording")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: outputs } = await db
    .from("outputs")
    .select("id, spec, status, error, rules_status, draft_url, timeline_json")
    .eq("pack_id", pack.id);
  const outputIds = (outputs ?? []).map((o) => o.id);
  const { data: rules } = outputIds.length
    ? await db.from("rule_results").select("output_id, rule, result, detail").in("output_id", outputIds)
    : { data: [] };

  const clips = source?.clips_json ? Clips.parse(source.clips_json) : [];
  const urls = await signedUrls([
    ...clips.flatMap((c) => [c.path, c.poster_path]),
    ...(outputs ?? []).flatMap((o) => (o.draft_url ? [o.draft_url] : [])),
  ]);

  return NextResponse.json({
    ...pack,
    recording: source && {
      id: source.id,
      status: source.status,
      error: source.error,
      file_name: source.file_name,
      duration_s: source.duration_s,
      clips: clips.map((c) => ({ id: c.id, start: c.start, duration: c.duration, url: urls[c.path], poster: urls[c.poster_path] })),
    },
    outputs: (outputs ?? []).map((o) => ({
      spec: o.spec,
      status: o.status,
      error: o.error,
      rules_status: o.rules_status,
      draft_url: o.draft_url ? urls[o.draft_url] ?? null : null,
      timeline: o.timeline_json,
      rules: (rules ?? []).filter((r) => r.output_id === o.id).map(({ output_id: _, ...r }) => r),
    })),
  });
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
