import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type BrandStyle, paletteFrom } from "./palette";

const run = promisify(execFile);

/** Used when an app has no icon, or its icon has no colour to speak of. */
export const DEFAULT_ACCENT = "#FF2E88";

function toHsl(r: number, g: number, b: number): [number, number, number] {
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

function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * The app's accent colour from its icon's pixels (RGB triples): the hue that most of the colourful pixels share,
 * lifted so it reads on a dark backdrop. Greys, near-whites and near-blacks don't vote. Falls back to
 * DEFAULT_ACCENT for an icon with no real colour.
 */
export function pickAccent(rgb: Uint8Array): string {
  const bins = new Array<{ weight: number; h: number; s: number }>(24).fill(null as never).map(() => ({ weight: 0, h: 0, s: 0 }));
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const [h, s, l] = toHsl(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    const bin = bins[Math.floor(h / 15) % 24]!;
    const w = s * (1 - Math.abs(l - 0.5));
    bin.weight += w;
    bin.h += h * w;
    bin.s += s * w;
  }
  const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a));
  if (best.weight < 1) return DEFAULT_ACCENT;
  return hslHex(best.h / best.weight, Math.min(1, Math.max(0.6, best.s / best.weight)), 0.6);
}

async function iconPixels(url: string): Promise<Uint8Array> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", url, "-vf", "scale=32:32", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024,
    timeout: 20_000,
  });
  return new Uint8Array(stdout);
}

/** The app's colours and type (see palette.ts), from its icon and genre. */
export async function iconStyle(url: string | null | undefined, genre?: string | null): Promise<BrandStyle> {
  if (!url) return paletteFrom(new Uint8Array(), genre);
  try {
    return paletteFrom(await iconPixels(url), genre);
  } catch {
    return paletteFrom(new Uint8Array(), genre);
  }
}

/** Accent colour of the icon at `url` (any format ffmpeg reads), or DEFAULT_ACCENT if it can't be read. */
export async function iconAccent(url: string | null | undefined): Promise<string> {
  if (!url) return DEFAULT_ACCENT;
  try {
    return pickAccent(await iconPixels(url));
  } catch {
    return DEFAULT_ACCENT;
  }
}
