import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, pickAccent } from "@/lib/media/accent";

const pixels = (...colours: [number, number, number, number][]) =>
  new Uint8Array(colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b]).flat()));

const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe("icon accent", () => {
  it("takes the colour most of the icon shares, ignoring white and black", () => {
    const green = pickAccent(pixels([31, 138, 91, 300], [255, 255, 255, 600], [0, 0, 0, 100], [244, 166, 42, 40]));
    expect(hue(green)).toBeGreaterThan(140);
    expect(hue(green)).toBeLessThan(170);
  });

  it("lifts a dark brand colour so it reads on the dark backdrop", () => {
    const navy = pickAccent(pixels([10, 30, 90, 500]));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(navy.slice(i, i + 2), 16));
    expect(Math.max(r!, g!, b!)).toBeGreaterThan(150);
  });

  it("falls back for a grey icon", () => {
    expect(pickAccent(pixels([128, 128, 128, 500], [250, 250, 250, 500]))).toBe(DEFAULT_ACCENT);
  });
});
