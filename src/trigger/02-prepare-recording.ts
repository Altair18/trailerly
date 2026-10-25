import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, task } from "@trigger.dev/sdk";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS, planClips } from "@/lib/media/clips";
import { cutClip, normalise, poster, probe, sceneChanges } from "@/lib/media/ffmpeg";
import type { Clip } from "@/lib/schemas/clips";
import { downloadTo, paths, uploadFile } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/**
 * Stage 2: ffprobe the upload, convert to 30 fps, split at scene changes
 * (ffmpeg scene filter), keep 3 to 6 clips of at least 2 seconds.
 */
export const prepareRecording = task({
  id: "prepare-recording",
  machine: "small-2x",
  run: async ({ packId, sourceId }: PackPayload & { sourceId: string }): Promise<{ clips: Clip[] }> => {
    const db = supabaseAdmin();
    const { data: source, error } = await db.from("sources").select("*").eq("id", sourceId).single();
    if (error) throw error;
    await db.from("sources").update({ status: "preparing", error: null }).eq("id", sourceId);

    const dir = await mkdtemp(join(tmpdir(), "rec-"));
    try {
      const raw = join(dir, "raw");
      const norm = join(dir, "norm.mp4");
      await downloadTo(source.url, raw);
      await normalise(raw, norm);

      const { duration } = await probe(norm);
      if (duration < MIN_RECORDING_SECONDS - 0.5 || duration > MAX_RECORDING_SECONDS + 0.5) {
        throw new Error(`The recording is ${Math.round(duration)} seconds. It needs to be 20 to 60 seconds.`);
      }

      const ranges = planClips(duration, await sceneChanges(norm));
      const clips: Clip[] = [];
      for (const [i, r] of ranges.entries()) {
        const n = i + 1;
        const clipFile = join(dir, `clip-${n}.mp4`);
        const posterFile = join(dir, `clip-${n}.jpg`);
        await cutClip(norm, clipFile, r.start, r.duration);
        await poster(clipFile, posterFile, Math.min(0.5, r.duration / 2));
        await uploadFile(paths.clip(packId, n), clipFile, "video/mp4");
        await uploadFile(paths.poster(packId, n), posterFile, "image/jpeg");
        clips.push({ id: `clip_${n}`, ...r, path: paths.clip(packId, n), poster_path: paths.poster(packId, n) });
      }

      await db.from("sources").update({ status: "ready", duration_s: duration, clips_json: clips }).eq("id", sourceId);
      logger.info("Recording prepared", { packId, duration, clips: clips.length });
      return { clips };
    } catch (err) {
      await db.from("sources").update({ status: "error", error: (err as Error).message }).eq("id", sourceId);
      throw err;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
