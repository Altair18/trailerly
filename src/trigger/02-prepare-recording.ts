import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, task } from "@trigger.dev/sdk";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS, planClips } from "@/lib/media/clips";
import { analyseClips, ClipNotesReply, type ClipFrames } from "@/lib/media/analyse";
import { blurRegions, chromeCrop, cutClip, frameAt, idleSpans, normalise, padRegions, poster, probe, sceneChanges, toPixels } from "@/lib/media/ffmpeg";
import { generateJson } from "@/lib/llm/claude";
import { Brief } from "@/lib/schemas/brief";
import { ShotList } from "@/lib/schemas/shotlist";
import type { Clip } from "@/lib/schemas/clips";
import { downloadTo, paths, uploadFile } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/**
 * Stage 2: ffprobe the upload, cut the phone's status and gesture bars, convert to 30 fps,
 * split at scene changes (ffmpeg scene filter), keep 3 to 6 clips of at least 2 seconds,
 * then have Claude label each clip and flag personal data from a few frames, and blur
 * the areas it marks so those clips are safe to use.
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
      const original = await probe(raw);
      await normalise(raw, norm, chromeCrop(original.width, original.height));

      const { duration } = await probe(norm);
      if (duration < MIN_RECORDING_SECONDS - 0.5 || duration > MAX_RECORDING_SECONDS + 0.5) {
        throw new Error(`The recording is ${Math.round(duration)} seconds. It needs to be 20 to 60 seconds.`);
      }

      const ranges = planClips(duration, await sceneChanges(norm));
      const version = `${sourceId.slice(0, 8)}-${Date.now().toString(36)}`;
      const clips: Clip[] = [];
      const frames: ClipFrames[] = [];
      for (const [i, r] of ranges.entries()) {
        const n = i + 1;
        const clipFile = join(dir, `clip-${n}.mp4`);
        const posterFile = join(dir, `clip-${n}.jpg`);
        await cutClip(norm, clipFile, r.start, r.duration);
        await poster(clipFile, posterFile, Math.min(0.5, r.duration / 2));
        await uploadFile(paths.clip(packId, version, n), clipFile, "video/mp4");
        await uploadFile(paths.poster(packId, version, n), posterFile, "image/jpeg");
        const clip: Clip = { id: `clip_${n}`, ...r, path: paths.clip(packId, version, n), poster_path: paths.poster(packId, version, n) };
        try {
          const idle = await idleSpans(clipFile, r.duration);
          if (idle.length) clip.idle = idle;
        } catch (err) {
          logger.warn("Dead-time check failed", { packId, clip: clip.id, error: (err as Error).message });
        }
        clips.push(clip);
        frames.push({ clipId: `clip_${n}`, frames: await sampleFrames(clipFile, dir, n, r.duration) });
      }

      // Best-effort: a clip without notes still works, the planner just knows less about it.
      try {
        const { data: pack } = await db.from("packs").select("brief_json, shot_list_json").eq("id", packId).single();
        const brief = Brief.safeParse(pack?.brief_json);
        const shotList = ShotList.safeParse(pack?.shot_list_json);
        const notes = await analyseClips(
          frames,
          brief.success ? brief.data.features : [],
          // Privacy matters most here and it runs once per recording, so it gets the main model.
          (opts) => generateJson({ ...opts, schema: ClipNotesReply, maxTokens: 4096, tier: "smart", effort: "medium" }),
          shotList.success ? shotList.data.shots.map((s) => s.action) : undefined,
        );
        for (const clip of clips) if (notes[clip.id]) clip.notes = notes[clip.id];
        await blurPrivateClips(clips, dir, packId, version, await probe(norm));
      } catch (err) {
        logger.warn("Clip check failed; continuing without notes", { packId, error: (err as Error).message });
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

/** Three frames per clip (start, middle, end) so the privacy boxes cover content that scrolls. */
async function sampleFrames(clipFile: string, dir: string, n: number, duration: number): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const [k, at] of [duration * 0.15, duration * 0.5, duration * 0.85].entries()) {
    const file = join(dir, `clip-${n}-f${k}.jpg`);
    await frameAt(clipFile, file, at);
    out.push(await readFile(file));
  }
  return out;
}

/** Share of the frame that can be blurred before a clip isn't worth showing. */
const MAX_BLUR_SHARE = 0.45;

/**
 * Blur the regions Claude marked in each private clip, re-upload the clip and its poster,
 * and mark it blurred. Mostly-blurred clips also lose interest so the planner prefers others.
 */
async function blurPrivateClips(clips: Clip[], dir: string, packId: string, version: string, size: { width: number; height: number }) {
  for (const [i, clip] of clips.entries()) {
    const regions = clip.notes?.personal_info ? padRegions(clip.notes.private_regions ?? []) : [];
    const rects = toPixels(regions, size.width, size.height);
    if (!clip.notes || rects.length === 0) continue;
    const n = i + 1;
    const src = join(dir, `clip-${n}.mp4`);
    const out = join(dir, `clip-${n}-blur.mp4`);
    const posterFile = join(dir, `clip-${n}-blur.jpg`);
    await blurRegions(src, out, rects);
    await poster(out, posterFile, Math.min(0.5, clip.duration / 2));
    // New names, so nothing can pick up the unblurred files from a cache.
    clip.path = paths.clip(packId, version, n, "-blurred");
    clip.poster_path = paths.poster(packId, version, n, "-blurred");
    await uploadFile(clip.path, out, "video/mp4");
    await uploadFile(clip.poster_path, posterFile, "image/jpeg");
    const share = rects.reduce((a, r) => a + r.w * r.h, 0) / (size.width * size.height);
    clip.notes = {
      ...clip.notes,
      blurred: true,
      interest: share > MAX_BLUR_SHARE ? Math.max(1, clip.notes.interest - 2) : clip.notes.interest,
    };
    logger.info("Blurred private areas", { packId, clip: clip.id, regions: rects.length, share: Math.round(share * 100) });
  }
}
