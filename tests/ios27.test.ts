import { describe, expect, it } from "vitest";
import { phoneBox, safeBox, textBox } from "@/remotion/compositions/Landscape";
import { DRAFT_SPECS, OUTPUT_SPECS, isLandscape } from "@/lib/specs/outputs";
import { STILL_SPECS, stillSecond, stillsFor } from "@/lib/specs/stills";
import { enforceSpec } from "@/lib/timeline/enforce";
import { fallbackTimeline } from "@/lib/timeline/preview";

const notes = (interest: number) => ({ label: "x", interest, personal_info: false });
const clips = [
  { id: "clip_1", duration: 9, notes: notes(5) },
  { id: "clip_2", duration: 8, notes: notes(3) },
];

describe("iOS 27 pack", () => {
  it("drafts header and search alongside the preview", () => {
    expect(DRAFT_SPECS).toEqual(["preview", "header", "search"]);
    expect(isLandscape(OUTPUT_SPECS.header)).toBe(true);
    expect(isLandscape(OUTPUT_SPECS.preview)).toBe(false);
  });

  it("keeps the header's phone centre and text inside Apple's safe box", () => {
    const { width, height, safeArea } = OUTPUT_SPECS.header;
    const box = safeBox(width, height, safeArea);
    expect(box).toEqual({ left: 1097, top: 493, width: 1646, height: 661 });
    const phone = phoneBox(box, height);
    const cx = phone.left + phone.width / 2;
    const cy = phone.top + phone.height / 2;
    expect(cx).toBeGreaterThan(box.left);
    expect(phone.left + phone.width).toBeLessThanOrEqual(box.left + box.width);
    expect(Math.abs(cy - (box.top + box.height / 2))).toBeLessThanOrEqual(1);
    const col = textBox(box, phone);
    expect(col.left).toBe(box.left);
    expect(col.left + col.width).toBeLessThan(phone.left);
    expect(col.width).toBeGreaterThan(box.width * 0.4);
  });

  it("builds a short header and search cut when the model fails", () => {
    for (const id of ["header", "search"] as const) {
      const spec = OUTPUT_SPECS[id];
      const t = fallbackTimeline(clips, "Stop guessing when to water", spec);
      const end = Math.max(...t.segments.filter((s) => !s.overlay).map((s) => s.start + s.duration));
      expect(end).toBeLessThanOrEqual(spec.targetSeconds);
      expect(end).toBeGreaterThanOrEqual(spec.minSeconds);
      expect(enforceSpec(t, spec, { clip_1: 9, clip_2: 8 })).toEqual([]);
    }
  });

  it("makes three stills at Apple's sizes", () => {
    expect(stillsFor("header").map((s) => s.id)).toEqual(["header", "universal"]);
    expect(stillsFor("search").map((s) => s.id)).toEqual(["search"]);
    expect(stillsFor("preview")).toEqual([]);
    expect([STILL_SPECS.header.width, STILL_SPECS.header.height]).toEqual([3840, 1646]);
    expect(STILL_SPECS.search.width / STILL_SPECS.search.height).toBe(1.5);
    expect([STILL_SPECS.universal.width, STILL_SPECS.universal.height]).toEqual([5244, 2950]);
  });

  it("takes the still while the hook is on screen", () => {
    expect(stillSecond({ segments: [{ type: "text", overlay: true, style: "hook", start: 0, duration: 3, text: "Hi" }] })).toBe(1.6);
    expect(stillSecond({ segments: [{ type: "screen", start: 0, duration: 5, clip_id: "c" }] })).toBe(1);
  });
});
