import { logger, task } from "@trigger.dev/sdk";
import type { PackPayload } from "./payload";

/**
 * Stage 6: each ai_scene becomes a video-model call through the router.
 * Vision QA per clip (no text/logos, no faces, 4+ safe), up to 3 tries, cached by prompt hash.
 */
export const generateScenes = task({
  id: "generate-scenes",
  run: async ({ packId }: PackPayload) => {
    logger.info("generate-scenes stub", { packId });
    // TODO(M3): for each ai_scene: promptHash -> cache lookup in `scenes`; assertBudget;
    // splitSeconds; generateScene; vision QA; recordSpend; store clip_url.
    return { scenes: 0 };
  },
});
