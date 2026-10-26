import { NextResponse } from "next/server";
import { z } from "zod";
import { validateChosen } from "@/lib/hooks";
import { ownedPack } from "@/lib/owned";
import { Brief } from "@/lib/schemas/brief";
import { Clips } from "@/lib/schemas/clips";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { appScreenshots } from "@/lib/media/screenshots";
import { Listing } from "@/lib/schemas/listing";
import { stillsFor } from "@/lib/specs/stills";
import { PACK_ZIP } from "@/lib/placement";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { downloadUrl, paths, signedUrls } from "@/lib/storage";
import { checkoutOpen } from "@/lib/stripe";
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
    .select("id, spec, status, error, rules_status, draft_url, final_url, timeline_json")
    .eq("pack_id", pack.id);
  const outputIds = (outputs ?? []).map((o) => o.id);
  const { data: rules } = outputIds.length
    ? await db.from("rule_results").select("output_id, rule, result, detail").in("output_id", outputIds)
    : { data: [] };

  const clips = source?.clips_json ? Clips.parse(source.clips_json) : [];
  const stillPaths = (o: { spec: string; status: string }) =>
    o.status === "ready" ? stillsFor(o.spec as never).map((s) => ({ still: s, path: paths.draftStill(pack.id, s.id) })) : [];
  const urls = await signedUrls([
    ...clips.flatMap((c) => [c.path, c.poster_path]),
    ...(outputs ?? []).flatMap((o) => (o.draft_url ? [o.draft_url] : [])),
    ...(outputs ?? []).flatMap((o) => stillPaths(o).map((s) => s.path)),
  ]);
  // Paid files download under their App Store Connect names.
  const finals = Object.fromEntries(
    await Promise.all(
      (outputs ?? []).flatMap((o) => (o.final_url ? [o] : [])).map(async (o) => {
        const spec = OUTPUT_SPECS[o.spec as OutputSpecId];
        const files = [
          { label: spec.label, fileName: spec.fileName, path: o.final_url! },
          ...stillsFor(o.spec as never).map((s) => ({ label: s.label, fileName: s.fileName, path: paths.final(pack.id, s.fileName) })),
        ];
        const signed = await Promise.all(files.map(async (f) => ({ label: f.label, fileName: f.fileName, url: await downloadUrl(f.path, f.fileName) })));
        return [o.id, signed.flatMap((f) => (f.url ? [{ ...f, url: f.url }] : []))] as const;
      }),
    ),
  );
  const zip = Object.keys(finals).length ? await downloadUrl(paths.final(pack.id, PACK_ZIP), zipName(pack.app?.name)) : null;
  const { data: app } = await db.from("apps").select("listing_json").eq("id", pack.app_id).single();
  const listing = Listing.safeParse(app?.listing_json);
  const images = Object.fromEntries(appScreenshots(listing.success ? listing.data : null).map((s) => [s.id, s.url]));

  return NextResponse.json({
    ...pack,
    recording: source && {
      id: source.id,
      status: source.status,
      error: source.error,
      file_name: source.file_name,
      duration_s: source.duration_s,
      clips: clips.map((c) => ({ id: c.id, start: c.start, duration: c.duration, url: urls[c.path], poster: urls[c.poster_path], notes: c.notes ?? null, idle: c.idle ?? [] })),
    },
    outputs: (outputs ?? []).map((o) => ({
      spec: o.spec,
      status: o.status,
      error: o.error,
      rules_status: o.rules_status,
      draft_url: o.draft_url ? urls[o.draft_url] ?? null : null,
      timeline: o.timeline_json,
      finals: finals[o.id] ?? [],
      rules: (rules ?? []).filter((r) => r.output_id === o.id).map(({ output_id: _, ...r }) => r),
      stills: stillPaths(o).flatMap(({ still, path }) =>
        urls[path] ? [{ id: still.id, label: still.label, size: `${still.width}×${still.height}`, fileName: still.fileName, url: urls[path] }] : [],
      ),
    })),
    images,
    checkout: checkoutOpen(),
    zip,
  });
}

/** "Royal Match" -> "royal-match-trailerly.zip". */
function zipName(appName: string | undefined): string {
  const slug = (appName ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug || "app"}-trailerly.zip`;
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

  if (pack.status !== "draft") return NextResponse.json({ error: "This pack is paid for, so it's locked." }, { status: 409 });

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
