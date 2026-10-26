import { describe, expect, it } from "vitest";
import { noRepeatedScreenshots, sharedWords, templateById } from "@/lib/timeline/templates";
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

describe("say each thing once", () => {
  it("finds key words shared between lines, ignoring filler and plurals", () => {
    expect(sharedWords("Unlock your royal boosters", ["Ready to unlock your next booster?"])).toEqual(["unlock", "booster"]);
    expect(sharedWords("Free to play", ["Match tiles, save the king"])).toEqual([]);
  });
  it("swaps a screenshot shown twice for one not used yet", () => {
    const t = templateById("promise-tour")!;
    const beats = noRepeatedScreenshots(
      t,
      { template_id: t.id, beats: ["s1", "s2", "s3", "s1", "s4", "s1"].map((source) => ({ source })) },
      new Set(["s1", "s2", "s3", "s4", "s5"]),
    );
    expect(beats.map((b) => b.source)).toEqual(["s1", "s2", "s3", "s5", "s4", "s1"]);
  });
});
