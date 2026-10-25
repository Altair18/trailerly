import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { Timeline } from "@/lib/timeline/schema";
import type { PackPayload } from "./payload";

const MAX_REPLANS = 2;

/** Stage 5: the model plans a timeline per output; code enforces the spec and re-asks with errors. */
export const planTimelines = task({
  id: "plan-timelines",
  run: async ({ packId, context }: PackPayload & { context: unknown }) => {
    const timelines: Partial<Record<OutputSpecId, Timeline>> = {};

    for (const spec of Object.values(OUTPUT_SPECS)) {
      let feedback = "";
      for (let attempt = 0; attempt <= MAX_REPLANS; attempt++) {
        const timeline = await generateJson({
          schema: Timeline,
          system:
            "You plan short app videos as a list of segments " +
            "{type: screen | ai_scene | text | end_card, start, duration, clip_id or prompt, text}.",
          prompt: JSON.stringify({ spec, context, feedback }),
        });
        const errors = enforceSpec(timeline, spec);
        if (errors.length === 0) {
          timelines[spec.id] = timeline;
          break;
        }
        feedback = `Your last plan broke these rules: ${errors.join(" ")}`;
      }
      if (!timelines[spec.id]) logger.warn("Timeline failed spec after retries", { packId, spec: spec.id });
    }

    // TODO(M2): write outputs.timeline_json rows.
    return { timelines };
  },
});
