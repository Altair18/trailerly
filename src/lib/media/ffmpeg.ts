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

/** A region in pixels, clamped to the frame and rounded to even numbers (yuv420p needs even sizes). */
export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Round to the nearest pixel first (so 79.9999 counts as 80), then down to an even number. */
const even = (n: number) => Math.floor(Math.round(n) / 2) * 2;

/**
 * Turn fractional regions (0 to 1) into pixel boxes inside a `width` x `height` frame.
 * Out-of-range values are clamped; boxes smaller than 16 px either way are dropped.
 */
export function toPixelBoxes(regions: { x: number; y: number; w: number; h: number }[], width: number, height: number): PixelBox[] {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  return regions.flatMap((r) => {
    const x0 = clamp(r.x), y0 = clamp(r.y);
    const x1 = clamp(r.x + r.w), y1 = clamp(r.y + r.h);
    const box = { x: even(x0 * width), y: even(y0 * height), w: even((x1 - x0) * width), h: even((y1 - y0) * height) };
    return box.w >= 16 && box.h >= 16 ? [box] : [];
  });
}

/**
 * ffmpeg filter graph that blurs each box heavily and lays it back over the frame.
 * The radius is capped per box because boxblur can't exceed half the (chroma) plane size.
 */
export function blurFilter(boxes: PixelBox[]): string {
  if (boxes.length === 0) return "[0:v]null[out]";
  const parts = [`[0:v]split=${boxes.length + 1}[base]${boxes.map((_, i) => `[c${i}]`).join("")}`];
  boxes.forEach((b, i) => {
    const luma = Math.max(1, Math.min(30, Math.floor(Math.min(b.w, b.h) / 2) - 1));
    const chroma = Math.max(1, Math.min(15, Math.floor(Math.min(b.w, b.h) / 4) - 1));
    parts.push(`[c${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},boxblur=luma_radius=${luma}:luma_power=3:chroma_radius=${chroma}:chroma_power=3[b${i}]`);
  });
  let prev = "base";
  boxes.forEach((b, i) => {
    const next = i === boxes.length - 1 ? "out" : `v${i}`;
    parts.push(`[${prev}][b${i}]overlay=${b.x}:${b.y}[${next}]`);
    prev = next;
  });
  return parts.join(";");
}

/** Re-encode `input` with the given boxes blurred for the whole clip. */
export async function blurRegions(input: string, output: string, boxes: PixelBox[]): Promise<void> {
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-filter_complex", blurFilter(boxes), "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

export async function poster(input: string, output: string, at = 0.5): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=360:-2", output], {
    maxBuffer: MAX_BUFFER,
  });
}
