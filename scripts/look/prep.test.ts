import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { planClips } from "@/lib/media/clips";
import { chromeCrop, cutClip, idleSpans, normalise, probe, sceneChanges } from "@/lib/media/ffmpeg";

const D = process.env.DEMO_DIR!;
it("prepares clips", async () => {
  const p = await probe(join(D, "demo.mp4"));
  await normalise(join(D, "demo.mp4"), join(D, "norm.mp4"), chromeCrop(p.width, p.height));
  const n = await probe(join(D, "norm.mp4"));
  const cuts = await sceneChanges(join(D, "norm.mp4"));
  const ranges = planClips(n.duration, cuts);
  const clips = [];
  for (const [i, r] of ranges.entries()) {
    const file = join(D, `clip_${i + 1}.mp4`);
    await cutClip(join(D, "norm.mp4"), file, r.start, r.duration);
    clips.push({ id: `clip_${i + 1}`, start: r.start, duration: r.duration, idle: await idleSpans(file, r.duration) });
  }
  console.log({ size: [n.width, n.height], cuts, clips: JSON.stringify(clips) });
  writeFileSync(join(D, "clips.json"), JSON.stringify(clips, null, 1));
});
