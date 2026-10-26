import { describe, expect, it } from "vitest";
import { headerHeadline, headerLayout, headlineSize, splitHeadline, splitLines } from "@/remotion/compositions/Brand";

describe("even caption lines", () => {
  it("doesn't leave one word alone on the top line at a comma", () => {
    const [a, b] = splitHeadline("Match, blast, and unlock rewards");
    expect(a).not.toBe("Match,");
    expect(Math.abs(a.length - b.length)).toBeLessThan(10);
  });
  it("still breaks at a full stop when the halves are even", () => {
    expect(splitHeadline("Snap a photo. Know what it is.")).toEqual(["Snap a photo.", "Know what it is."]);
  });
  it("splits into three even lines", () => {
    const lines = splitLines("Ready to unlock your next booster?", 3);
    expect(lines).toHaveLength(3);
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(15);
  });
});

describe("header line", () => {
  it("sets a long hook at least 1.4x bigger than round 3 did", () => {
    const safe = { w: 1646 / 3840, h: 661 / 1646 };
    const L = headerLayout(3840, 1646, safe);
    const hook = "Ready to unlock your next booster?";
    const before = headlineSize(splitHeadline(hook), "geometric", 3840 * (1646 / 3840) * 0.53, 661 * 0.25);
    const { size } = headerHeadline(hook, "geometric", L.text.width, L.text.height);
    expect(size).toBeGreaterThan(before * 1.4);
    // Three lines plus the wordmark still fit the safe box's height.
    expect(size * 3 * 1.12).toBeLessThan(L.text.height * 0.85);
  });
});
