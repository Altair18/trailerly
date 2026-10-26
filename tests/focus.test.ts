import { describe, expect, it } from "vitest";
import { focusFor, motionFocus } from "@/lib/timeline/focus";
import { zoomAt } from "@/remotion/compositions/Landscape";

const W = 10;
const H = 20;
const frame = (lit: [number, number][] = []) => {
  const f = new Uint8Array(W * H);
  for (const [x, y] of lit) f[y * W + x] = 255;
  return f;
};

describe("focus", () => {
  it("finds where the screen changed", () => {
    const pts = motionFocus([frame(), frame([[8, 16], [9, 17]])], W, H, 5);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.x).toBeCloseTo(0.9, 1);
    expect(pts[0]!.y).toBeCloseTo(0.84, 1);
    expect(pts[0]!.amount).toBeCloseTo(0.01, 3);
  });

  it("averages local motion in a window and ignores stills and full-screen changes", () => {
    const pts = [
      { t: 1, x: 0.2, y: 0.3, amount: 0.02 },
      { t: 2, x: 0.4, y: 0.5, amount: 0.02 },
      { t: 3, x: 0.5, y: 0.5, amount: 0.9 },
      { t: 9, x: 0.9, y: 0.9, amount: 0.05 },
    ];
    expect(focusFor(pts, 0, 4)).toEqual({ x: expect.closeTo(0.3, 5), y: expect.closeTo(0.4, 5) });
    expect(focusFor(pts, 4, 3)).toBeNull();
    expect(focusFor(undefined, 0, 4)).toBeNull();
  });

  it("zooms in after a shot settles and back out before the cut", () => {
    expect(zoomAt(0, 120, 1.4)).toBe(1);
    expect(zoomAt(60, 120, 1.4)).toBeCloseTo(1.4);
    expect(zoomAt(119, 120, 1.4)).toBeCloseTo(1, 1);
    expect(zoomAt(30, 50, 1.4)).toBe(1);
  });
});
