import { describe, expect, it } from "vitest";
import { planClips } from "@/lib/media/clips";

const total = (r: { duration: number }[]) => Math.round(r.reduce((n, c) => n + c.duration, 0) * 100) / 100;

describe("planClips", () => {
  it("keeps clean cuts as clips", () => {
    expect(planClips(30, [6, 15, 23])).toEqual([
      { start: 0, duration: 6 },
      { start: 6, duration: 9 },
      { start: 15, duration: 8 },
      { start: 23, duration: 7 },
    ]);
  });
  it("folds pieces under 2 seconds into a neighbour", () => {
    const r = planClips(30, [1, 10, 10.5, 20]);
    expect(r.every((c) => c.duration >= 2)).toBe(true);
    expect(total(r)).toBe(30);
  });
  it("merges down to 6 clips", () => {
    const cuts = Array.from({ length: 14 }, (_, i) => (i + 1) * 3);
    const r = planClips(45, cuts);
    expect(r).toHaveLength(6);
    expect(total(r)).toBe(45);
  });
  it("splits up to 3 clips when there are no cuts", () => {
    const r = planClips(24, []);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(total(r)).toBe(24);
  });
  it("covers the recording contiguously", () => {
    const r = planClips(40, [3, 3.5, 12, 30, 39.5]);
    r.slice(1).forEach((c, i) => expect(c.start).toBeCloseTo(r[i]!.start + r[i]!.duration, 1));
  });
});
