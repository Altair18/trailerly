import { describe, expect, it } from "vitest";
import { draftSpecsFor, OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { fallbackTimeline } from "@/lib/timeline/preview";
import { variantHooks, withHook } from "@/lib/timeline/variants";

const notes = { label: "x", interest: 4, personal_info: false };
const clips = [{ id: "clip_1", duration: 9, notes }, { id: "clip_2", duration: 8, notes }];

describe("A/B set", () => {
  it("picks the other chosen hooks first, then proposed ones, never the headline", () => {
    const proposed = ["Headline hook", "Ad one", "Spare one", "Spare two"].map((text) => ({ text }));
    expect(variantHooks({ headline: "Headline hook", social: ["Headline hook", "Ad one"] }, proposed)).toEqual(["Ad one", "Spare one"]);
    expect(variantHooks({ headline: "Headline hook", social: [] }, [{ text: "Headline hook" }])).toEqual([]);
  });

  it("adds B and C variants only when there are hooks for them", () => {
    expect(draftSpecsFor([])).toEqual(["preview", "header", "search"]);
    expect(draftSpecsFor(["x"])).toEqual(["preview", "header", "search", "header_b", "search_b"]);
    expect(draftSpecsFor(["x", "y"])).toHaveLength(7);
    expect(OUTPUT_SPECS.header_c).toMatchObject({ width: 3840, height: 1646, variantOf: "header", variant: "C", fileName: "appstore-header-21x9-c.mp4" });
  });

  it("swaps the hook and keeps the cut valid", () => {
    const spec = OUTPUT_SPECS.header_b;
    const base = fallbackTimeline(clips, "Stop guessing when to water", OUTPUT_SPECS.header);
    const t = withHook(base, "Never kill another plant. Seriously, never again");
    const hook = t.segments.find((s) => s.style === "hook")!;
    expect(hook.text).toBe("Never kill another plant");
    expect(t.segments.filter((s) => !s.overlay)).toEqual(base.segments.filter((s) => !s.overlay));
    expect(enforceSpec(t, spec, { clip_1: 9, clip_2: 8 })).toEqual([]);
    expect(base.segments.find((s) => s.style === "hook")!.text).toBe("Stop guessing when to water");
  });

  it("adds a hook line when the base cut has none", () => {
    const t = withHook({ segments: [{ type: "screen", start: 0, duration: 8, clip_id: "clip_1" }] }, "Plants, sorted");
    expect(t.segments.find((s) => s.style === "hook")).toMatchObject({ start: 0, text: "Plants, sorted" });
  });
});
