import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import { ClipNotesReply } from "@/lib/media/analyse";
import { appScreenshots, labelScreenshots, type Screenshot } from "@/lib/media/screenshots";
import { Listing } from "@/lib/schemas/listing";
import { loadPackWithApp, readyClips } from "@/lib/packs";
import { Brief } from "@/lib/schemas/brief";
import { isPrivate } from "@/lib/schemas/clips";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { skipDeadStarts } from "@/lib/timeline/dead-time";
import { enforceSpec } from "@/lib/timeline/enforce";
import { PLANNER_SYSTEM, planTimeline } from "@/lib/timeline/plan";
import { fallbackTimeline } from "@/lib/timeline/preview";
import { variantHooks, withHook } from "@/lib/timeline/variants";
import { Timeline } from "@/lib/timeline/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/** Stage 5: the model plans a timeline per output; code enforces the spec and re-asks with errors. */
export const planTimelines = task({
  id: "plan-timelines",
  run: async ({ packId, specs }: PackPayload & { specs: OutputSpecId[] }) => {
    const db = supabaseAdmin();
    const { pack, app } = await loadPackWithApp(packId);
    const brief = Brief.parse(pack.brief_json);
    const chosen = ChosenHooks.parse(pack.chosen_hooks ?? { social: [], headline: null });
    const clips = await readyClips(packId);
    const listing = Listing.safeParse(app.listing_json);
    let screenshots: Screenshot[] = appScreenshots(listing.success ? listing.data : null);
    if (clips.length === 0 && screenshots.length === 0) {
      throw new Error("Add a screen recording: this app has no App Store screenshots to fall back on.");
    }
    // Screenshots only matter when clean footage is short, so only pay to label them then.
    const cleanSeconds = clips.filter((c) => !isPrivate(c.notes)).reduce((n, c) => n + c.duration, 0);
    if (cleanSeconds >= 20) screenshots = [];
    if (screenshots.length > 0) {
      try {
        screenshots = await labelScreenshots(screenshots, brief.features, (opts) =>
          generateJson({ ...opts, schema: ClipNotesReply, maxTokens: 2048 }),
        );
      } catch (err) {
        logger.warn("Couldn't label screenshots; planning without labels", { packId, error: (err as Error).message });
      }
    }

    const extraHooks = variantHooks(chosen, (pack.hooks_json ?? []) as Hook[]);
    const clipSeconds = Object.fromEntries(clips.map((c) => [c.id, c.duration]));
    const imageIds = screenshots.map((s) => s.id);

    const timelines: Partial<Record<OutputSpecId, Timeline>> = {};
    for (const id of specs) {
      const spec = OUTPUT_SPECS[id];
      await db.from("outputs").upsert({ pack_id: packId, spec: id, status: "planning", error: null }, { onConflict: "pack_id,spec" });

      if (spec.variantOf && spec.variant) {
        // A/B variant: the base cut with another hook. No model call.
        const hook = extraHooks[spec.variant === "B" ? 0 : 1];
        const base = timelines[spec.variantOf] ?? (await savedTimeline(packId, spec.variantOf));
        if (!hook || !base) throw new Error(`No ${!hook ? "hook" : "base cut"} for ${spec.label}.`);
        let timeline = withHook(base, hook);
        if (enforceSpec(timeline, spec, clipSeconds, imageIds).length > 0) {
          timeline = fallbackTimeline(clips, hook, spec, screenshots);
        }
        timelines[id] = timeline;
        await db
          .from("outputs")
          .update({ timeline_json: timeline, status: "queued", updated_at: new Date().toISOString() })
          .eq("pack_id", packId)
          .eq("spec", id);
        logger.info("Variant planned", { packId, spec: id, hook });
        continue;
      }

      const socialIndex = id.startsWith("social_") ? Number(id.slice(-1)) - 1 : -1;
      const planned = await planTimeline(
        spec,
        { brief, headline: chosen.headline, socialHook: chosen.social[socialIndex] ?? null, clips, screenshots },
        (prompt) => generateJson({ schema: Timeline, system: PLANNER_SYSTEM, prompt, tier: "smart" }),
      );
      // Never open a shot on a loading screen or a frozen stretch when the clip has better footage after it.
      const timeline = skipDeadStarts(planned.timeline, clips);
      timelines[id] = timeline;
      await db
        .from("outputs")
        .update({ timeline_json: timeline, status: "queued", updated_at: new Date().toISOString() })
        .eq("pack_id", packId)
        .eq("spec", id);
      logger.info("Timeline planned", { packId, spec: id, source: planned.source, attempts: planned.attempts });
    }
    return { timelines };
  },
});

async function savedTimeline(packId: string, spec: OutputSpecId): Promise<Timeline | null> {
  const { data } = await supabaseAdmin().from("outputs").select("timeline_json").eq("pack_id", packId).eq("spec", spec).maybeSingle();
  const parsed = Timeline.safeParse(data?.timeline_json);
  return parsed.success ? parsed.data : null;
}
