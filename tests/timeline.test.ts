import { describe, expect, it } from "vitest";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { splitSeconds } from "@/lib/video/router";

describe("enforceSpec", () => {
  it("passes a screen-only preview", () => {
    expect(
      enforceSpec({ segments: [{ type: "screen", start: 0, duration: 20, clip_id: "c1" }] }, OUTPUT_SPECS.preview),
    ).toEqual([]);
  });
  it("rejects AI scenes in the preview", () => {
    const errors = enforceSpec(
      { segments: [{ type: "ai_scene", start: 0, duration: 20, prompt: "a sunrise" }] },
      OUTPUT_SPECS.preview,
    );
    expect(errors.some((e) => e.includes("not allowed"))).toBe(true);
  });
  it("requires 40% real screens in social ads", () => {
    const errors = enforceSpec(
      {
        segments: [
          { type: "ai_scene", start: 0, duration: 8, prompt: "x" },
          { type: "text", start: 8, duration: 10, text: "hi" },
          { type: "screen", start: 18, duration: 2, clip_id: "c1" },
        ],
      },
      OUTPUT_SPECS.social_1,
    );
    expect(errors.some((e) => e.includes("Real screens"))).toBe(true);
  });
});

describe("splitSeconds", () => {
  it("splits into 4 to 8 second clips", () => {
    expect(splitSeconds(16)).toEqual([8, 8]);
    expect(splitSeconds(10)).toEqual([6, 4]);
    expect(splitSeconds(6)).toEqual([6]);
  });
});
