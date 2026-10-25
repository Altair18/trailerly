import { describe, expect, it } from "vitest";
import { imageType } from "@/lib/llm/claude";
import { blurFilterGraph, toPixels } from "@/lib/media/ffmpeg";
import { appScreenshots, labelScreenshots, SCREENSHOT_SECONDS } from "@/lib/media/screenshots";
import { previewScreenshots } from "@/lib/rules/checks/plain";
import { isPrivate } from "@/lib/schemas/clips";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { fallbackPreview } from "@/lib/timeline/preview";

const notes = (interest: number, personal_info = false) => ({ label: "x", interest, personal_info });
const shots = [
  { id: "shot_1", notes: notes(5) },
  { id: "shot_2", notes: notes(3) },
];

describe("blurring private areas", () => {
  it("turns fractions into even pixel rectangles and drops tiny ones", () => {
    expect(toPixels([{ x: 0.1, y: 0.25, w: 0.5, h: 0.1 }, { x: 0.9, y: 0.9, w: 0.001, h: 0.001 }], 1080, 2184)).toEqual([
      { x: 108, y: 546, w: 540, h: 218 },
    ]);
  });
  it("keeps rectangles inside the frame", () => {
    const [r] = toPixels([{ x: 0.8, y: 0.9, w: 0.5, h: 0.5 }], 1000, 1000);
    expect(r!.x + r!.w).toBeLessThanOrEqual(1000);
    expect(r!.y + r!.h).toBeLessThanOrEqual(1000);
  });
  it("chains one blurred crop per rectangle into [out]", () => {
    const g = blurFilterGraph([{ x: 0, y: 0, w: 100, h: 50 }, { x: 10, y: 200, w: 40, h: 40 }]);
    expect(g).toMatch(/^\[0:v\]split=3\[base\]\[r0\]\[r1\]/);
    expect(g).toContain("[r0]crop=100:50:0:0,boxblur");
    expect(g).toContain("[base][b0]overlay=0:0[v0]");
    expect(g.endsWith("[v0][b1]overlay=10:200[out]")).toBe(true);
  });
  it("treats a blurred clip as safe to use", () => {
    expect(isPrivate({ ...notes(4, true) })).toBe(true);
    expect(isPrivate({ ...notes(4, true), blurred: true })).toBe(false);
    expect(isPrivate(undefined)).toBe(false);
  });
});

describe("screenshot mode", () => {
  it("numbers the listing's screenshots", () => {
    expect(appScreenshots({ screenshot_urls: ["a", "b"] })).toEqual([
      { id: "shot_1", url: "a" },
      { id: "shot_2", url: "b" },
    ]);
    expect(appScreenshots(null)).toEqual([]);
  });
  it("labels screenshots with the clip check", async () => {
    const out = await labelScreenshots(
      [{ id: "shot_1", url: "https://x/1.png" }],
      ["Search"],
      async () => ({ clips: [{ clip_id: "shot_1", label: "Search results", interest: 4, personal_info: false }] }),
      async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    expect(out[0]!.notes?.label).toBe("Search results");
  });
  it("tops up short footage with screenshots to reach the minimum", () => {
    const spec = OUTPUT_SPECS.preview;
    const t = fallbackPreview([{ id: "c1", duration: 8, notes: notes(4) }], "Find any bug fast", spec, shots);
    const base = t.segments.filter((s) => !s.overlay);
    expect(base[0]!.type).toBe("screen");
    expect(base.slice(1).every((s) => s.type === "screenshot")).toBe(true);
    const end = base.reduce((n, s) => Math.max(n, s.start + s.duration), 0);
    expect(end).toBeGreaterThanOrEqual(spec.minSeconds);
    expect(enforceSpec(t, spec, { c1: 8 }, ["shot_1", "shot_2"])).toEqual([]);
  });
  it("builds a screenshot-only video when there's no recording", () => {
    const spec = OUTPUT_SPECS.preview;
    const t = fallbackPreview([], "Find any bug fast", spec, shots);
    const base = t.segments.filter((s) => !s.overlay);
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((s) => s.type === "screenshot" && s.duration <= SCREENSHOT_SECONDS)).toBe(true);
    expect(enforceSpec(t, spec, {}, ["shot_1", "shot_2"])).toEqual([]);
  });
  it("rejects screenshot segments with an unknown image", () => {
    const errors = enforceSpec(
      { segments: [{ type: "screenshot", start: 0, duration: 20, image_id: "shot_9" }] },
      OUTPUT_SPECS.preview,
      {},
      ["shot_1"],
    );
    expect(errors.join(" ")).toMatch(/shot_9/);
  });
  it("warns that a preview made of screenshots may be rejected", async () => {
    const t = { segments: [{ type: "screenshot" as const, start: 0, duration: 3, image_id: "shot_1" }] };
    expect((await previewScreenshots.check({ timeline: t, spec: OUTPUT_SPECS.preview } as never)).result).toBe("warn");
  });
  it("detects image types for the vision call", () => {
    expect(imageType(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(imageType(Buffer.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(imageType(Buffer.from("RIFF0000WEBP"))).toBe("image/webp");
  });
});

describe("safeClips", () => {
  it("drops private clips only when the rest (plus screenshots) is long enough", async () => {
    const { safeClips } = await import("@/lib/timeline/plan");
    const clips = [
      { id: "a", duration: 10, notes: notes(4) },
      { id: "b", duration: 10, notes: notes(5, true) },
    ];
    expect(safeClips(clips, { minSeconds: 15 }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(safeClips(clips, { minSeconds: 15 }, 6).map((c) => c.id)).toEqual(["a"]);
  });
});
