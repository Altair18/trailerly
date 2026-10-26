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
  it("counts a flat dark frame as empty", () => {
    expect(blankShare(new Uint8Array(128 * 128).fill(10), 128, 128)).toBeGreaterThan(0.5);
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

describe("landscape templates", () => {
  it("pass the pacing rules at header and search lengths", async () => {
    const { TEMPLATES, buildFromTemplate } = await import("@/lib/timeline/templates");
    const { OUTPUT_SPECS } = await import("@/lib/specs/outputs");
    const clips = [1, 2, 3].map((n) => ({ id: `clip_${n}`, start: 0, duration: 20, path: "", notes: { label: `Feature ${n}`, interest: 4, feature: `F${n}`, personal_info: false } }));
    for (const t of TEMPLATES.filter((t) => t.shape === "landscape")) {
      for (const id of ["header", "search"] as const) {
        const fill = { template_id: t.id, beats: t.beats.map((b, i) => ({ source: `clip_${(i % 3) + 1}`, offset: 0, caption: b.caption ? "Short caption here" : undefined })) };
        const built = buildFromTemplate(t, fill, OUTPUT_SPECS[id], { hook: "Never forget to water again", clips } as never);
        expect(built.timeline, `${t.id} ${id}: ${built.errors.join("; ")}`).toBeTruthy();
        expect(lintLandscapeTimeline(built.timeline!), `${t.id} ${id}`).toEqual([]);
      }
    }
  });
});

describe("blankShare on dark screens", () => {
  it("flags an empty dark canvas and passes a busy dark-mode screen", () => {
    const empty = new Uint8Array(128 * 128).fill(12);
    for (let x = 0; x < 128; x += 3) for (let y = 0; y < 12; y++) empty[y * 128 + x] = 220;
    expect(blankShare(empty, 128, 128)).toBeGreaterThan(0.5);
    const busy = new Uint8Array(128 * 128).fill(12);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x += 3) busy[y * 128 + x] = 220;
    expect(blankShare(busy, 128, 128)).toBeLessThan(0.05);
  });
});
