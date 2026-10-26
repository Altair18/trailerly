// Each app's own colours and type, so no two packs look like the same template. Agency App Store videos dress
// every frame in the brand: a deep backdrop in the icon's main colour, one bright second colour for the words that
// matter and the active screen, and a typeface that fits the kind of app. Pure (no Node imports): the Remotion
// bundle uses it as the fallback when a render only has an accent colour.

export type BrandFont = "geometric" | "condensed" | "editorial";

export interface BrandStyle {
  /** Backdrop, light end of its gradient. */
  bg: string;
  /** Backdrop, deep end of its gradient. */
  bgDeep: string;
  /** The bright second colour: second line of a headline, the active card's outline, the dashed curve. */
  highlight: string;
  /** Words on the backdrop. */
  ink: string;
  font: BrandFont;
}

export function toHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function hexHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  return toHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** Hue distance on the colour wheel (0 to 180). */
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** App Store genres that suit a tall, tight, energetic face, and those that suit a book face. */
const CONDENSED = /game|sport|fitness|entertainment|music/i;
const EDITORIAL = /book|news|magazine|reference/i;

export function fontFor(genre?: string | null): BrandFont {
  if (genre && EDITORIAL.test(genre)) return "editorial";
  if (genre && CONDENSED.test(genre)) return "condensed";
  return "geometric";
}

/**
 * Backdrop and highlight from a main hue (and a second icon hue when there is one). Yellows and oranges go muddy
 * when darkened, so they get a near-black warm backdrop with the colour itself as the highlight.
 */
function styleFromHues(main: { h: number; s: number }, second: number | null, font: BrandFont): BrandStyle {
  const { h, s } = main;
  if (h >= 38 && h <= 75) {
    return { bg: hsl(h - 10, 0.3, 0.13), bgDeep: hsl(h - 15, 0.25, 0.06), highlight: hsl(h, 0.95, 0.58), ink: "#FFFFFF", font };
  }
  const sat = Math.min(0.85, Math.max(0.55, s));
  // A one-colour icon gets a lighter neighbour hue, so the second line stands clear of the backdrop rather than
  // reading as a paler copy of it: green -> lime, blue -> aqua, purple -> sky; reds and pinks warm up to gold.
  const warm = h >= 300 || h < 30;
  const highlight = second !== null ? hsl(second, 0.9, 0.68) : hsl(warm ? h + 45 : h - 50, 0.95, warm ? 0.66 : 0.72);
  return { bg: hsl(h, sat, 0.33), bgDeep: hsl(h + 6, sat, 0.13), highlight, ink: "#FFFFFF", font };
}

/** No real colour in the icon: graphite backdrop, white words, a clean blue for the highlight. */
const NEUTRAL = (font: BrandFont): BrandStyle => ({ bg: "#2A2B31", bgDeep: "#0E0F12", highlight: "#7CC4FF", ink: "#FFFFFF", font });

/**
 * The brand style from an icon's pixels (RGB triples) and the app's genre. Colourful pixels vote for a hue, weighted
 * by how vivid they are; the winning hue dresses the backdrop and a clearly different runner-up (if the icon has
 * one) becomes the highlight.
 */
export function paletteFrom(rgb: Uint8Array, genre?: string | null): BrandStyle {
  const font = fontFor(genre);
  const bins = Array.from({ length: 24 }, () => ({ weight: 0, h: 0, s: 0 }));
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const [h, s, l] = toHsl(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    const bin = bins[Math.floor(h / 15) % 24]!;
    const w = s * (1 - Math.abs(l - 0.5));
    bin.weight += w;
    bin.h += h * w;
    bin.s += s * w;
  }
  const ranked = bins
    .filter((b) => b.weight > 0)
    .map((b) => ({ weight: b.weight, h: b.h / b.weight, s: b.s / b.weight }))
    .sort((a, b) => b.weight - a.weight);
  const main = ranked[0];
  if (!main || main.weight < 1) return NEUTRAL(font);
  const second = ranked.find((b) => hueGap(b.h, main.h) >= 40 && b.weight >= main.weight * 0.15);
  return styleFromHues(main, second ? second.h : null, font);
}

/** The brand style from just an accent colour, for renders made before styles were stored. */
export function paletteFromAccent(accent: string, genre?: string | null): BrandStyle {
  const [h, s] = hexHsl(accent);
  return s < 0.2 ? NEUTRAL(fontFor(genre)) : styleFromHues({ h, s }, null, fontFor(genre));
}
