import { logger, task } from "@trigger.dev/sdk";
import type { FinalPayload } from "./payload";

/**
 * Stage 8: render each output's Remotion composition from its timeline JSON.
 * Drafts: one third size + watermark. Finals (after payment): upscale AI clips first.
 */
export const compose = task({
  id: "compose",
  run: async ({ packId, final }: FinalPayload) => {
    logger.info("compose stub", { packId, final });
    // TODO(M2): @remotion/renderer on the worker; upload to Storage; set outputs.draft_url / final_url.
    return { rendered: 0 };
  },
});
