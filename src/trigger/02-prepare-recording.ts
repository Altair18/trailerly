import { logger, task } from "@trigger.dev/sdk";
import type { PackPayload } from "./payload";

export interface Clip {
  id: string;
  start: number;
  duration: number;
  url: string;
}

/**
 * Stage 2: ffprobe the upload, convert to 30 fps, split at scene changes
 * (ffmpeg scene filter), keep 3 to 6 clips of at least 2 seconds.
 */
export const prepareRecording = task({
  id: "prepare-recording",
  run: async ({ packId, sourceId }: PackPayload & { sourceId: string }): Promise<{ clips: Clip[] }> => {
    logger.info("prepare-recording stub", { packId, sourceId });
    // TODO(M2): download from Storage, run ffprobe/ffmpeg, upload clips, write sources.clips_json.
    return { clips: [] };
  },
});
