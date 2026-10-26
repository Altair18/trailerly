import { describe, expect, it } from "vitest";
import { blankRuns, blankShare, lintLandscapeTimeline } from "@/lib/media/render-lint";

/** A 128x128 greyscale frame: white, with text-like stripes in the top `busy` share of rows. */
function frame(busy: number): Uint8Array {
  const g = new Uint8Array(128 * 128).fill(250);
  for (let y = 0; y < Math.round(128 * busy); y++) for (let x = 0; x < 128; x += 3) g[y * 128 + x] = 40;
  return g;
}

describe("blankShare", () => {
  it("is low for a full screen and high for a half-empty one", () => {
    expect(blankShare(frame(1), 128, 128)).toBeLessThan(0.05);
    expect(blankShare(frame(0.5), 128, 128)).toBeGreaterThan(0.15);
  });
  it("ignores dark frames", () => {
    expect(blankShare(new Uint8Array(128 * 128).fill(10), 128, 128)).toBe(0);
  });
});

describe("blankRuns", () => {
  it("needs two samples in a row", () => {
    expect(blankRuns([0, 0.5, 0, 0.5, 0.5, 0.5, 0])).toEqual([{ start: 1.5, duration: 1.5 }]);
  });
});

describe("lintLandscapeTimeline", () => {
  it("flags long beats, two captions in a beat and a long logo close", () => {
    const issues = lintLandscapeTimeline({
      segments: [
        { type: "screen", start: 0, duration: 6, clip_id: "clip_1" },
        { type: "screen", start: 6, duration: 4, clip_id: "clip_2" },
        { type: "text", start: 0.5, duration: 2, text: "One", overlay: true, style: "caption" },
        { type: "text", start: 3, duration: 2, text: "Two", overlay: true, style: "caption" },
        { type: "text", start: 7, duration: 3, overlay: true, style: "brand" },
      ],
    });
    expect(issues).toHaveLength(3);
  });
  it("passes a clean cut", () => {
    expect(
      lintLandscapeTimeline({
        segments: [
          { type: "screen", start: 0, duration: 4, clip_id: "clip_1" },
          { type: "text", start: 0.5, duration: 2, text: "One", overlay: true, style: "caption" },
          { type: "text", start: 2.5, duration: 1.5, overlay: true, style: "brand" },
        ],
      }),
    ).toEqual([]);
  });
});
