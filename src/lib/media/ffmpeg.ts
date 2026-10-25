import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

export interface Probe {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", file],
    { maxBuffer: MAX_BUFFER },
  );
  const json = JSON.parse(stdout) as {
    streams: Array<{ width: number; height: number; r_frame_rate: string }>;
    format: { duration: string };
  };
  const stream = json.streams[0];
  if (!stream) throw new Error("No video stream found");
  const [num, den] = stream.r_frame_rate.split("/").map(Number);
  return {
    duration: Number(json.format.duration),
    width: stream.width,
    height: stream.height,
    fps: den ? num! / den : num!,
  };
}

/**
 * Phone chrome to cut from a portrait screen recording: the status bar (clock, battery,
 * notification icons) at the top and the home indicator / gesture bar at the bottom.
 * Fractions of the frame height; sized for current iPhones and Android phones at 19.5:9 to 20:9.
 */
export const STATUS_BAR = 0.055;
export const GESTURE_BAR = 0.035;

/** ffmpeg crop filter that removes phone chrome from portrait recordings; null for landscape. */
export function chromeCrop(width: number, height: number): string | null {
  if (height <= width) return null;
  const top = Math.round((height * STATUS_BAR) / 2) * 2;
  const bottom = Math.round((height * GESTURE_BAR) / 2) * 2;
  return `crop=${width}:${height - top - bottom}:0:${top}`;
}

/**
 * Re-encode to constant 30 fps H.264, no audio (screen recordings carry none worth keeping).
 * Pass `crop` (from chromeCrop) to cut the status and gesture bars at the same time.
 */
export async function normalise(input: string, output: string, crop?: string | null): Promise<void> {
  const filters = [crop, "fps=30", "scale=trunc(iw/2)*2:trunc(ih/2)*2"].filter(Boolean).join(",");
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-vf", filters, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

/** Times (seconds) where the picture changes by more than `threshold` (0 to 1). */
export async function sceneChanges(file: string, threshold = 0.3): Promise<number[]> {
  const { stderr } = await run(
    "ffmpeg",
    ["-v", "info", "-i", file, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"],
    { maxBuffer: MAX_BUFFER },
  );
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

export async function cutClip(input: string, output: string, start: number, duration: number): Promise<void> {
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-ss", String(start), "-i", input, "-t", String(duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

/** One JPEG frame at `at` seconds, `width` px wide, for the vision check. */
export async function frameAt(input: string, output: string, at: number, width = 512): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", output], {
    maxBuffer: MAX_BUFFER,
  });
}

export async function poster(input: string, output: string, at = 0.5): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=360:-2", output], {
    maxBuffer: MAX_BUFFER,
  });
}

export interface PixelRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fractional regions to even pixel rectangles inside a width x height frame (tiny ones dropped). */
export function toPixels(regions: { x: number; y: number; w: number; h: number }[], width: number, height: number): PixelRegion[] {
  const even = (n: number) => Math.max(0, Math.floor(n / 2) * 2);
  return regions
    .map((r) => {
      const x = even(Math.min(Math.max(r.x, 0), 1) * width);
      const y = even(Math.min(Math.max(r.y, 0), 1) * height);
      const w = even(Math.min(r.w * width, width - x));
      const h = even(Math.min(r.h * height, height - y));
      return { x, y, w, h };
    })
    .filter((r) => r.w >= 16 && r.h >= 16);
}

/** filter_complex that blurs each rectangle heavily and lays it back over the frame. */
export function blurFilterGraph(rects: PixelRegion[]): string {
  const n = rects.length;
  const parts = [`[0:v]split=${n + 1}[base]${rects.map((_, i) => `[r${i}]`).join("")}`];
  rects.forEach((r, i) => parts.push(`[r${i}]crop=${r.w}:${r.h}:${r.x}:${r.y},boxblur=luma_radius=min(w\\,h)/6:luma_power=3[b${i}]`));
  let last = "base";
  rects.forEach((r, i) => {
    const out = i === n - 1 ? "out" : `v${i}`;
    parts.push(`[${last}][b${i}]overlay=${r.x}:${r.y}[${out}]`);
    last = out;
  });
  return parts.join(";");
}

/** Re-encode a clip with the given rectangles blurred for its whole length. */
export async function blurRegions(input: string, output: string, rects: PixelRegion[]): Promise<void> {
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-filter_complex", blurFilterGraph(rects), "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

/**
 * Grow privacy boxes so the blur doesn't stop just short of the text: pad every side, and snap to the frame's
 * edge when the box is already close to it (lists and panels usually run to the edge).
 */
export function padRegions<R extends { x: number; y: number; w: number; h: number }>(regions: R[], pad = 0.03, snap = 0.15): R[] {
  return regions.map((r) => {
    let x1 = Math.max(0, r.x - pad);
    let y1 = Math.max(0, r.y - pad);
    let x2 = Math.min(1, r.x + r.w + pad);
    let y2 = Math.min(1, r.y + r.h + pad);
    if (x1 < snap) x1 = 0;
    if (y1 < snap) y1 = 0;
    if (x2 > 1 - snap) x2 = 1;
    if (y2 > 1 - snap) y2 = 1;
    return { ...r, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  });
}

export interface Span {
  start: number;
  duration: number;
}

/** Read ffmpeg freezedetect output into still stretches; a freeze still running at the end closes at `duration`. */
export function parseFreezes(log: string, duration: number): Span[] {
  const spans: Span[] = [];
  let open: number | null = null;
  for (const line of log.split("\n")) {
    const start = line.match(/freeze_start:\s*([\d.]+)/);
    const end = line.match(/freeze_end:\s*([\d.]+)/);
    if (start) open = Number(start[1]);
    if (end && open !== null) {
      spans.push({ start: open, duration: Number(end[1]) - open });
      open = null;
    }
  }
  if (open !== null && duration > open) spans.push({ start: open, duration: duration - open });
  return spans.map((s) => ({ start: Math.round(s.start * 100) / 100, duration: Math.round(s.duration * 100) / 100 })).filter((s) => s.duration > 0);
}

/** Read ffmpeg blackdetect output into dark stretches (loading and blank screens). */
export function parseBlacks(log: string): Span[] {
  const spans: Span[] = [];
  for (const m of log.matchAll(/black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)/g)) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (end > start) spans.push({ start: Math.round(start * 100) / 100, duration: Math.round((end - start) * 100) / 100 });
  }
  return spans;
}

/** Union of spans, sorted, with touching or overlapping spans joined. */
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.start + last.duration + 0.05) {
      last.duration = Math.round((Math.max(last.start + last.duration, s.start + s.duration) - last.start) * 100) / 100;
    } else out.push({ ...s });
  }
  return out;
}

/**
 * Dead time: stretches of at least `min` seconds where nothing on screen changes, plus stretches of at least
 * half a second where the screen is (nearly) black, such as a launch or loading screen.
 */
export async function idleSpans(input: string, duration: number, min = 1.2): Promise<Span[]> {
  const { stderr } = await run(
    "ffmpeg",
    [
      "-hide_banner", "-v", "info", "-i", input, "-map", "0:v:0",
      "-vf", `freezedetect=n=0.003:d=${min},blackdetect=d=0.5:pic_th=0.9:pix_th=0.12`,
      "-f", "null", "-",
    ],
    { maxBuffer: MAX_BUFFER },
  );
  return mergeSpans([...parseFreezes(stderr, duration), ...parseBlacks(stderr)]);
}

/** Re-save an image as an RGB PNG with no alpha channel (App Store Connect rejects transparency). */
export async function flattenPng(input: string, output: string): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-frames:v", "1", "-pix_fmt", "rgb24", output], { maxBuffer: MAX_BUFFER });
}
