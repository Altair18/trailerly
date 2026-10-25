import { logger, task } from "@trigger.dev/sdk";
import { runRules, worst } from "@/lib/rules";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { Timeline } from "@/lib/timeline/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/** Stage 9: run the rules engine on every output and store each result with the render. */
export const checkRules = task({
  id: "check-rules",
  run: async ({ packId, specs }: PackPayload & { specs: OutputSpecId[] }) => {
    const db = supabaseAdmin();
    const summary: Partial<Record<OutputSpecId, string>> = {};
    for (const id of specs) {
      const { data: output, error } = await db.from("outputs").select("id, timeline_json").eq("pack_id", packId).eq("spec", id).single();
      if (error) throw error;
      const results = await runRules(OUTPUT_SPECS[id], Timeline.parse(output.timeline_json));
      await db.from("rule_results").delete().eq("output_id", output.id);
      await db.from("rule_results").insert(
        results.map((r) => ({ output_id: output.id, rule: r.rule, result: r.result, detail: r.detail ?? null })),
      );
      summary[id] = worst(results);
      await db.from("outputs").update({ rules_status: worst(results) }).eq("id", output.id);
    }
    logger.info("Rules checked", { packId, summary });
    return { summary };
  },
});
