import { describe, expect, it } from "vitest";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { cropScreenshotHeadlines, doubleHeadlines, headlineCrop } from "@/lib/timeline/headlines";
import type { Timeline } from "@/lib/timeline/schema";
import { buildFromTemplate, keepPosterClear, POSTER_SECOND, templateById } from "@/lib/timeline/templates";

const clips = [
  { id: "clip_1", duration: 12, notes: { label: "Adds a plant", interest: 4, personal_info: false } },
  { id: "clip_2", duration: 10, notes: { label: "Gets a reminder", interest: 5, personal_info: false } },
  { id: "clip_3", duration: 9, notes: { label: "Scans a leaf", interest: 4, personal_info: false } },
  { id: "clip_4", duration: 8, notes: { label: "Sees the diagnosis", interest: 4, personal_info: false } },
];

describe("agency script: hook, benefits, payoff, closing line", () => {
  const spec = OUTPUT_SPECS.preview;
  const fill = {
    template_id: "promise-tour",
    beats: [
      { source: "clip_2" },
      { source: "clip_1", caption: "Every plant, one place" },
      { source: "clip_3", caption: "Snap a leaf, get a fix" },
      { source: "clip_4", caption: "Know what's wrong" },
      { source: "clip_2", offset: 4, caption: "Your plants, thriving" },
      { source: "clip_1", offset: 6 },
    ],
    closing_line: "Start growing today",
  };
  const built = buildFromTemplate(templateById("promise-tour")!, fill, spec, { hook: "Stop guessing when to water", clips });

  it("runs about 19 s and passes the preview spec", () => {
    expect(built.timeline).not.toBeNull();
    const t = built.timeline!;
    const end = Math.max(...t.segments.map((s) => s.start + s.duration));
    expect(end).toBeGreaterThanOrEqual(17);
    expect(end).toBeLessThanOrEqual(21);
    expect(enforceSpec(t, spec)).toEqual([]);
  });

  it("ends on the closing line under the app's name", () => {
    const close = built.timeline!.segments.find((s) => s.style === "brand");
    expect(close?.text).toBe("Start growing today");
  });

  it("drops a closing line that repeats an earlier line's words", () => {
    const echo = buildFromTemplate(templateById("promise-tour")!, { ...fill, closing_line: "Never lose a plant again" }, spec, { hook: "Stop guessing when to water", clips });
    expect(echo.timeline!.segments.find((s) => s.style === "brand")?.text).toBeUndefined();
  });

  it("never cuts within half a second of the 5 s poster frame", () => {
    const cuts = built.timeline!.segments.filter((s) => !s.overlay).map((s) => s.start);
    expect(cuts.every((c) => Math.abs(c - POSTER_SECOND) >= 0.49)).toBe(true);
  });
});

describe("keepPosterClear", () => {
  const roomy = { available: 10, least: 1.2 };
  it("moves a cut at 5 s to just after it", () => {
    const lengths = [3, 2, 5, 5];
    keepPosterClear(lengths, [roomy, roomy, roomy, roomy]);
    expect(lengths[0]! + lengths[1]!).toBeCloseTo(5.5);
    expect(lengths.reduce((a, b) => a + b, 0)).toBeCloseTo(15);
  });
  it("moves it earlier when the earlier beat can't grow", () => {
    const lengths = [3, 2.2, 5];
    keepPosterClear(lengths, [roomy, { available: 2.2, least: 1.2 }, roomy]);
    expect(lengths[0]! + lengths[1]!).toBeCloseTo(4.5);
  });
  it("leaves cuts away from 5 s alone", () => {
    const lengths = [3, 4, 5];
    keepPosterClear(lengths, [roomy, roomy, roomy]);
    expect(lengths).toEqual([3, 4, 5]);
  });
});

describe("screenshot headlines", () => {
  const shots = [
    { id: "shot_1", notes: { headline_band: { edge: "top" as const, h: 0.22 } } },
    { id: "shot_2", notes: { headline_band: null } },
    { id: "shot_3", notes: { headline_band: { edge: "bottom" as const, h: 0.8 } } },
  ];
  it("crops a sensible band and ignores implausible ones", () => {
    expect(headlineCrop(shots[0]!.notes)).toEqual({ top: 0.22 });
    expect(headlineCrop(shots[1]!.notes)).toBeUndefined();
    expect(headlineCrop(shots[2]!.notes)).toBeUndefined();
  });
  it("crops screenshot segments and flags text left over an uncropped headline", () => {
    const t: Timeline = {
      segments: [
        { type: "screenshot", start: 0, duration: 4, image_id: "shot_1" },
        { type: "screenshot", start: 4, duration: 4, image_id: "shot_3" },
        { type: "text", overlay: true, style: "hook", start: 0, duration: 3, text: "Save the king" },
        { type: "text", overlay: true, style: "caption", start: 4, duration: 4, text: "Clear the board" },
      ],
    };
    expect(doubleHeadlines(t, shots)).toHaveLength(2);
    const cropped = cropScreenshotHeadlines(t, shots);
    expect(cropped.segments[0]!.crop).toEqual({ top: 0.22 });
    expect(cropped.segments[1]!.crop).toBeUndefined();
    expect(doubleHeadlines(cropped, shots)).toEqual(["Text sits over shot_3 at 4s, which has its own headline: crop it or drop the text."]);
  });
});
