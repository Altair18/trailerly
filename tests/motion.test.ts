import { describe, expect, it } from "vitest";
import { focusFrom, type MotionFrames, withFocus } from "@/lib/media/motion";

const W = 24;
const H = 52;
function clip(change: (f: number, x: number, y: number) => number, n = 12): MotionFrames {
  const frames = Array.from({ length: n }, (_, f) => {
    const a = new Uint8Array(W * H);
    for (let i = 0; i < a.length; i++) a[i] = change(f, i % W, Math.floor(i / W));
    return a;
  });
  return { w: W, h: H, fps: 4, frames };
}

describe("following the action", () => {
  // A small area near the bottom right flickers; the rest is still.
  const local = clip((f, x, y) => (x > 14 && x < 20 && y > 34 && y < 42 ? (f % 2) * 200 : 50));
  // The whole screen changes (a scroll or a new page).
  const whole = clip((f) => (f % 2) * 200);

  it("finds where the screen changes when the change is local", () => {
    const focus = focusFrom(local, 0, 3);
    expect(focus).not.toBeNull();
    expect(focus!.x).toBeCloseTo(0.71, 1);
    expect(focus!.y).toBeCloseTo(0.73, 1);
    expect(focus!.zoom).toBeGreaterThan(1);
  });

  it("gives no focus for whole-screen changes or still footage", () => {
    expect(focusFrom(whole, 0, 3)).toBeNull();
    expect(focusFrom(clip(() => 80), 0, 3)).toBeNull();
  });

  it("adds a focus to recording shots only", () => {
    const t = withFocus(
      { segments: [{ type: "screen", clip_id: "a", start: 0, duration: 3 }, { type: "screenshot", image_id: "s", start: 3, duration: 3 }] },
      { a: local },
    );
    expect(t.segments[0]!.focus).toBeDefined();
    expect(t.segments[1]!.focus).toBeUndefined();
  });
});
