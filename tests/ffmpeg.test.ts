import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planClips } from "@/lib/media/clips";
import { cutClip, normalise, probe, sceneChanges } from "@/lib/media/ffmpeg";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// A 24 s portrait "recording" with four flat-colour screens, 6 s each, at 60 fps.
function makeRecording(dir: string): string {
  const out = join(dir, "rec.mov");
  const colours = ["black", "white", "navy", "yellow"];
  const inputs = colours.flatMap((c) => ["-f", "lavfi", "-i", `color=c=${c}:s=360x780:d=6:r=60`]);
  const filter = `${colours.map((_, i) => `[${i}:v]`).join("")}concat=n=${colours.length}:v=1:a=0[v]`;
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "[v]", out]);
  return out;
}

describe.skipIf(!hasFfmpeg)("recording prep with ffmpeg", () => {
  it("normalises to 30 fps, finds screen changes and cuts clips", async () => {
    const dir = mkdtempSync(join(tmpdir(), "trailerly-"));
    const norm = join(dir, "norm.mp4");
    await normalise(makeRecording(dir), norm);

    const info = await probe(norm);
    expect(info.fps).toBe(30);
    expect(info.duration).toBeCloseTo(24, 0);

    const cuts = await sceneChanges(norm);
    expect(cuts.map(Math.round)).toEqual([6, 12, 18]);

    const clips = planClips(info.duration, cuts);
    expect(clips).toHaveLength(4);

    const first = join(dir, "clip-1.mp4");
    await cutClip(norm, first, clips[0]!.start, clips[0]!.duration);
    expect((await probe(first)).duration).toBeCloseTo(6, 0);
  }, 60_000);
});
