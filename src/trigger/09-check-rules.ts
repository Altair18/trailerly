import { logger, task } from "@trigger.dev/sdk";
import { runRules, worst } from "@/lib/rules";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import type { Timeline } from "@/lib/timeline/schema";
import type { PackPayload } from "./payload";

/** Stage 9: run the rules engine on every output; blocks stop export. */
export const checkRules = task({
  id: "check-rules",
  run: async ({ packId, timelines }: PackPayload & { timelines: Partial<Record<OutputSpecId, Timeline>> }) => {
    const summary: Partial<Record<OutputSpecId, string>> = {};
    for (const [id, timeline] of Object.entries(timelines) as Array<[OutputSpecId, Timeline]>) {
      const results = await runRules(OUTPUT_SPECS[id], timeline);
      summary[id] = worst(results);
      // TODO(M4): insert rule_results rows and set outputs.rules_status.
    }
    logger.info("Rules checked", { packId, summary });
    return { summary };
  },
});
