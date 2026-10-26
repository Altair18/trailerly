import { describe, expect, it } from "vitest";
import { fontFor, paletteFrom, paletteFromAccent, toHsl } from "@/lib/media/palette";
import { soundtrackFor } from "@/lib/media/music";
import { headerLayout, searchLayout, splitHeadline, spotlight } from "@/remotion/compositions/Brand";

const solid = (r: number, g: number, b: number, n = 64) => new Uint8Array(Array.from({ length: n }, () => [r, g, b]).flat());
const hue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return toHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

describe("brand palette", () => {
  it("dresses a green icon in deep green with a lighter, different highlight", () => {
    const p = paletteFrom(solid(46, 158, 106));
    expect(hue(p.bg)[0]).toBeGreaterThan(120);
    expect(hue(p.bg)[0]).toBeLessThan(170);
    expect(hue(p.bg)[2]).toBeLessThan(0.4);
    expect(hue(p.highlight)[2]).toBeGreaterThan(0.6);
    expect(Math.abs(hue(p.highlight)[0] - hue(p.bg)[0])).toBeGreaterThan(30);
  });
  it("uses an icon's second colour as the highlight", () => {
    const icon = new Uint8Array([...solid(30, 90, 220, 48), ...solid(250, 200, 40, 16)]);
    const p = paletteFrom(icon);
    expect(hue(p.bg)[0]).toBeGreaterThan(200);
    expect(hue(p.highlight)[0]).toBeGreaterThan(30);
    expect(hue(p.highlight)[0]).toBeLessThan(60);
  });
  it("keeps yellow icons off a muddy backdrop", () => {
    const p = paletteFrom(solid(255, 200, 0));
    expect(hue(p.bg)[2]).toBeLessThan(0.2);
    expect(hue(p.highlight)[1]).toBeGreaterThan(0.8);
  });
  it("falls back to graphite for a colourless icon", () => {
    expect(paletteFrom(solid(128, 128, 128)).bg).toBe("#2A2B31");
    expect(paletteFromAccent("#888888").bg).toBe("#2A2B31");
  });
  it("picks a type that fits the genre", () => {
    expect(fontFor("Games")).toBe("condensed");
    expect(fontFor("Health & Fitness")).toBe("condensed");
    expect(fontFor("Books")).toBe("editorial");
    expect(fontFor("Productivity")).toBe("geometric");
    expect(fontFor(undefined)).toBe("geometric");
  });
});

describe("headlines", () => {
  it("splits at a sentence break", () => {
    expect(splitHeadline("Snap a photo. Know what it is.")).toEqual(["Snap a photo.", "Know what it is."]);
  });
  it("splits into two even lines", () => {
    expect(splitHeadline("Never forget to water again")).toEqual(["Never forget", "to water again"]);
  });
  it("keeps short lines whole", () => {
    expect(splitHeadline("Water on time")[1]).toBe("");
  });
});

describe("layouts", () => {
  it("fills the header: hero card at 80% height, other screens out to both edges", () => {
    const L = headerLayout(3840, 1646, { w: 1646 / 3840, h: 661 / 1646 });
    expect(L.hero.height / 1646).toBeCloseTo(0.8, 2);
    // Within a small margin of each edge: nothing but backdrop is left over at the sides.
    expect(Math.min(...L.sides.map((s) => s.box.left))).toBeLessThanOrEqual(40);
    expect(Math.max(...L.sides.map((s) => s.box.left + s.box.width))).toBeGreaterThanOrEqual(3840 - 40);
    expect(L.text.left + L.text.width).toBeLessThan(L.hero.left);
  });
  it("lays search out as a headline over three cards", () => {
    const L = searchLayout(1920, 1280, { w: 2168 / 3840, h: 1030 / 2560 });
    expect(L.cards).toHaveLength(3);
    expect(L.text.top + L.text.height).toBeLessThan(L.cards[0]!.top);
  });
  it("moves the spotlight along the row and refills a card when it comes round again", () => {
    expect(spotlight(0, 4).active).toBe(0);
    expect(spotlight(2, 4).active).toBe(2);
    expect([0, 1, 2].map((c) => spotlight(1, 4).shows(c))).toEqual([0, 1, 2]);
    expect([0, 1, 2].map((c) => spotlight(3, 4).shows(c))).toEqual([3, 1, 2]);
  });
});

describe("soundtrack", () => {
  const manifest = {
    beds: [
      { id: "game-bounce", file: "music/game-bounce.mp3", moods: ["game", "playful"] },
      { id: "tech-pulse", file: "music/tech-pulse.mp3", moods: ["focused", "tech"] },
    ],
    effects: [{ id: "whoosh", file: "music/whoosh.mp3" }, { id: "pop", file: "music/pop.mp3" }],
  };
  it("is silent until the library is made", () => {
    expect(soundtrackFor(null, "Games", "p1")).toEqual({});
  });
  it("matches the bed to the genre and keeps it stable per pack", () => {
    expect(soundtrackFor(manifest, "Games", "p1").bed).toBe("music/game-bounce.mp3");
    expect(soundtrackFor(manifest, "Finance", "p1").bed).toBe("music/tech-pulse.mp3");
    expect(soundtrackFor(manifest, "Finance", "p1")).toEqual(soundtrackFor(manifest, "Finance", "p1"));
    expect(soundtrackFor(manifest, "Finance", "p1").whoosh).toBe("music/whoosh.mp3");
  });
});
