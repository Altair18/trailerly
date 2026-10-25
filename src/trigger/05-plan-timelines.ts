import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import { loadPackWithApp, readyClips } from "@/lib/packs";
import { Brief } from "@/lib/schemas/brief";
import { ChosenHooks } from "@/lib/schemas/hooks";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { PLANNER_SYSTEM, planTimeline } from "@/lib/timeline/plan";
import { Timeline } from "@/lib/timeline/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/** Stage 5: the model plans a timeline per output; code enforces the spec and re-asks with errors. */
export const planTimelines = task({
  id: "plan-timelines",
  run: async ({ packId, specs }: PackPayload & { specs: OutputSpecId[] }) => {
    const db = supabaseAdmin();
    const { pack } = await loadPackWithApp(packId);
    const brief = Brief.parse(pack.brief_json);
    const chosen = ChosenHooks.parse(pack.chosen_hooks ?? { social: [], headline: null });
    const clips = await readyClips(packId);
    if (clips.length === 0) throw new Error("The recording isn't ready yet.");

    const timelines: Partial<Record<OutputSpecId, Timeline>> = {};
    for (const id of specs) {
      const spec = OUTPUT_SPECS[id];
      await db.from("outputs").upsert({ pack_id: packId, spec: id, status: "planning", error: null }, { onConflict: "pack_id,spec" });

      const socialIndex = id.startsWith("social_") ? Number(id.slice(-1)) - 1 : -1;
      const { timeline, source, attempts } = await planTimeline(
        spec,
        { brief, headline: chosen.headline, socialHook: chosen.social[socialIndex] ?? null, clips },
        (prompt) => generateJson({ schema: Timeline, system: PLANNER_SYSTEM, prompt }),
      );
      timelines[id] = timeline;
      await db
        .from("outputs")
        .update({ timeline_json: timeline, status: "queued", updated_at: new Date().toISOString() })
        .eq("pack_id", packId)
        .eq("spec", id);
      logger.info("Timeline planned", { packId, spec: id, source, attempts });
    }
    return { timelines };
  },
});
