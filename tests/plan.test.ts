import { describe, expect, it } from "vitest";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { planTimeline } from "@/lib/timeline/plan";
import { fallbackPreview } from "@/lib/timeline/preview";
import type { Timeline } from "@/lib/timeline/schema";

const clips = [
  { id: "clip_1", duration: 6 },
  { id: "clip_2", duration: 9 },
  { id: "clip_3", duration: 8 },
  { id: "clip_4", duration: 7 },
];
const brief = { what_it_does: "x", audience: "y", features: ["a", "b", "c"], review_phrases: [], tone: "Warm" };
const ctx = { brief, headline: "Stop guessing when to water", clips };
const clipSeconds = Object.fromEntries(clips.map((c) => [c.id, c.duration]));

const good: Timeline = {
  segments: [
    { type: "screen", start: 0, duration: 9, clip_id: "clip_2" },
    { type: "screen", start: 9, duration: 6, clip_id: "clip_1" },
    { type: "screen", start: 15, duration: 5, clip_id: "clip_3" },
    { type: "text", overlay: true, start: 0, duration: 3, text: "Stop guessing when to water" },
  ],
};

describe("fallbackPreview", () => {
  it("passes the preview spec and trims to 30 s", () => {
    const t = fallbackPreview(clips, "Hello", OUTPUT_SPECS.preview);
    expect(enforceSpec(t, OUTPUT_SPECS.preview, clipSeconds)).toEqual([]);
    expect(Math.max(...t.segments.map((s) => s.start + s.duration))).toBe(30);
  });
});

describe("enforceSpec on screen timelines", () => {
  it("catches gaps and clip overruns", () => {
    const errors = enforceSpec(
      {
        segments: [
          { type: "screen", start: 0, duration: 10, clip_id: "clip_1" },
          { type: "screen", start: 12, duration: 8, clip_id: "clip_2" },
        ],
      },
      OUTPUT_SPECS.preview,
      clipSeconds,
    );
    expect(errors.join(" ")).toMatch(/runs past the end of clip_1/);
    expect(errors.join(" ")).toMatch(/Gap from 10s to 12s/);
  });
});

describe("planTimeline with templates", () => {
  const fill = {
    template_id: "promise-tour",
    beats: [
      { source: "clip_2" },
      { source: "clip_3", caption: "Water reminders that adapt" },
      { source: "clip_4", caption: "Snap a leaf, get a fix" },
      { source: "clip_1", caption: "Track every plant" },
      { source: "clip_2", offset: 3 },
    ],
  };

  it("takes the fast model's fill when it builds a valid plan", async () => {
    const tiers: string[] = [];
    const result = await planTimeline(OUTPUT_SPECS.preview, ctx, async (_p, tier) => {
      tiers.push(tier);
      return fill;
    });
    expect(tiers).toEqual(["fast"]);
    expect(result).toMatchObject({ source: "fast", attempts: 1 });
    expect(result.timeline).toMatchObject({ template: "promise-tour", planned_by: "fast" });
    expect(enforceSpec(result.timeline, OUTPUT_SPECS.preview, clipSeconds)).toEqual([]);
  });

  it("retries once on the main model with the errors, then accepts", async () => {
    const prompts: string[] = [];
    const tiers: string[] = [];
    const result = await planTimeline(OUTPUT_SPECS.preview, ctx, async (p, tier) => {
      prompts.push(p);
      tiers.push(tier);
      return prompts.length === 1 ? { ...fill, beats: fill.beats.slice(0, 3) } : fill;
    });
    expect(tiers).toEqual(["fast", "smart"]);
    expect(result).toMatchObject({ source: "smart", attempts: 2 });
    expect(prompts[1]).toMatch(/has 5 beats; you filled 3/);
  });

  it("falls back to a code-built cut when both models fail", async () => {
    let n = 0;
    const result = await planTimeline(OUTPUT_SPECS.preview, ctx, async () => {
      n++;
      throw new Error("bad json");
    });
    expect(n).toBe(2);
    expect(result.source).toBe("fallback");
    expect(result.timeline.planned_by).toBe("fallback");
    expect(enforceSpec(result.timeline, OUTPUT_SPECS.preview, clipSeconds)).toEqual([]);
  });
});
