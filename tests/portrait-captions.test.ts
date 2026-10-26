import { expect, it } from "vitest";
import { overScreenshot } from "@/remotion/compositions/TimelineVideo";
import type { Segment } from "@/lib/timeline/schema";

it("finds captions that sit over a store screenshot", () => {
  const base: Segment[] = [
    { type: "screenshot", image_id: "shot_1", start: 0, duration: 3 },
    { type: "screen", clip_id: "clip_1", start: 3, duration: 3 },
  ];
  const cap = (start: number, duration: number): Segment => ({ type: "text", overlay: true, style: "caption", text: "x", start, duration });
  expect(overScreenshot(cap(0, 3), base)).toBe(true);
  expect(overScreenshot(cap(3, 3), base)).toBe(false);
  expect(overScreenshot(cap(2, 3), base)).toBe(false);
});
