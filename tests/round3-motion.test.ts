import { describe, expect, it } from "vitest";
import { heldHeaderLine } from "@/remotion/compositions/Brand";
import { afterLanding } from "@/remotion/compositions/TimelineVideo";
import type { Segment } from "@/lib/timeline/schema";

describe("header holds one line", () => {
  it("keeps the hook for the whole loop and drops the rest", () => {
    const held = heldHeaderLine(
      [
        { start: 0, duration: 3, style: "hook", text: "Match your way to the crown" },
        { start: 3, duration: 3, style: "caption", text: "New levels daily" },
        { start: 6, duration: 2, style: "brand", text: "Play free" },
      ],
      8,
    );
    expect(held).toEqual([{ start: 0, duration: 8, style: "hook", text: "Match your way to the crown" }]);
  });
  it("falls back to the first line with words when there is no hook", () => {
    expect(heldHeaderLine([{ start: 2, duration: 3, style: "caption", text: "Plan meals" }], 9)[0]).toMatchObject({ start: 0, duration: 9 });
  });
});

describe("brand close waits for the last card", () => {
  const card = { type: "screenshot", start: 20, duration: 5 } as Segment;
  it("starts after a card dealt in at the same moment has landed", () => {
    expect(afterLanding({ type: "overlay", style: "brand", start: 20, duration: 5 } as Segment, [card], 30)).toBe(600 + 20);
  });
  it("leaves it alone over a recording or a settled card", () => {
    expect(afterLanding({ type: "overlay", style: "brand", start: 23, duration: 2 } as Segment, [card], 30)).toBe(690);
    expect(afterLanding({ type: "overlay", style: "brand", start: 20, duration: 5 } as Segment, [{ ...card, type: "screen" } as Segment], 30)).toBe(600);
  });
});
