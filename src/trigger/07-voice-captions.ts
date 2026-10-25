import { logger, task } from "@trigger.dev/sdk";
import type { PackPayload } from "./payload";

/** Stage 7: TTS for each social script with word timings that drive burned-in captions. */
export const voiceCaptions = task({
  id: "voice-captions",
  run: async ({ packId }: PackPayload) => {
    logger.info("voice-captions stub", { packId });
    // TODO(M5): ElevenLabs with timestamps; store audio + word timings per social output.
    return { voiced: 0 };
  },
});
