import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blurFilter, blurRegions, probe, toPixelBoxes } from "@/lib/media/ffmpeg";
import { BriefDraft } from "@/lib/schemas/brief";
import { type Clip, showsPersonalData } from "@/lib/schemas/clips";
import { HookSet } from "@/lib/schemas/hooks";
import { safeClips } from "@/lib/timeline/plan";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const clip = (id: string, duration: number, notes?: Clip["notes"]) => ({ id, duration, notes });
const privateNotes = { label: "Sidebar", interest: 3, personal_info: true };

describe("lenient model replies", () => {
  it("accepts over-long hooks and review phrases so code can drop them", () => {
    expect(HookSet.safeParse({ hooks: [{ text: "one two three four five six seven eight nine", format: "question" }] }).success).toBe(true);
    const brief = { what_it_does: "x", audience: "y", features: ["a", "b", "c"], review_phrases: ["a phrase that is much longer than eight words long"], tone: "calm" };
    expect(BriefDraft.safeParse(brief).success).toBe(true);
  });
});

describe("toPixelBoxes", () => {
  it("converts fractions to even pixel boxes and clamps to the frame", () => {
    expect(toPixelBoxes([{ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }], 400, 800)).toEqual([{ x: 40, y: 160, w: 200, h: 200 }]);
    expect(toPixelBoxes([{ x: -0.2, y: 0.9, w: 2, h: 0.5 }], 400, 800)).toEqual([{ x: 0, y: 720, w: 400, h: 80 }]);
  });
  it("drops boxes too small to matter", () => {
    expect(toPixelBoxes([{ x: 0.5, y: 0.5, w: 0.01, h: 0.5 }], 400, 800)).toEqual([]);
  });
});

describe("blurFilter", () => {
  it("chains one crop, blur and overlay per box", () => {
    const f = blurFilter([{ x: 0, y: 0, w: 100, h: 40 }, { x: 10, y: 100, w: 200, h: 200 }]);
    expect(f).toContain("split=3[base][c0][c1]");
    expect(f).toContain("[c0]crop=100:40:0:0,boxblur=luma_radius=19:luma_power=3:chroma_radius=9");
    expect(f).toContain("[base][b0]overlay=0:0[v0]");
    expect(f).toContain("[v0][b1]overlay=10:100[out]");
  });
});

describe("safeClips", () => {
  const spec = { minSeconds: 15 };
  it("leaves out clips that still show personal data when the rest are long enough", () => {
    const clips = [clip("a", 10), clip("b", 8), clip("c", 9, privateNotes)];
    expect(safeClips(clips, spec).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("keeps blurred clips", () => {
    const clips = [clip("a", 10), clip("c", 9, { ...privateNotes, blurred: true })];
    expect(showsPersonalData(clips[1]!)).toBe(false);
    expect(safeClips(clips, spec).map((c) => c.id)).toEqual(["a", "c"]);
  });
  it("keeps everything when the clean clips are too short", () => {
    const clips = [clip("a", 6), clip("c", 12, privateNotes)];
    expect(safeClips(clips, spec).map((c) => c.id)).toEqual(["a", "c"]);
  });
});

describe.skipIf(!hasFfmpeg)("blurRegions with ffmpeg", () => {
  it("re-encodes the clip at the same size with the boxes blurred", async () => {
    const dir = mkdtempSync(join(tmpdir(), "trailerly-blur-"));
    const input = join(dir, "in.mp4");
    const output = join(dir, "out.mp4");
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=360x780:d=2:r=30", "-pix_fmt", "yuv420p", input]);
    await blurRegions(input, output, toPixelBoxes([{ x: 0, y: 0, w: 1, h: 0.3 }, { x: 0.1, y: 0.5, w: 0.5, h: 0.2 }], 360, 780));
    const info = await probe(output);
    expect(info.width).toBe(360);
    expect(info.height).toBe(780);
    expect(info.duration).toBeCloseTo(2, 0);
  });
});
