import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Span } from "@/lib/media/ffmpeg";
import { isOverlay } from "@/lib/timeline/enforce";
import type { Timeline } from "@/lib/timeline/schema";

const run = promisify(execFile);

// "Naturalness" checks for header and search videos, taken from how top apps' App Store videos are cut:
// short beats, one caption per beat, a short logo close, and no app screen that is mostly empty.
// The timing rules report problems and never block a render; empty screens are kept out at the clip stage.

/** Longest a single shot should hold before something changes. */
export const MAX_BEAT_SECONDS = 5;
/** Longest the closing logo should stay up. */
export const MAX_OUTRO_SECONDS = 2;
/** Share of the app screen that may be one flat colour before it reads as a broken screen. */
export const MAX_BLANK_SHARE = 0.15;

const EPS = 0.05;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Timing rules for a header or search timeline. Empty means it passes. */
export function lintLandscapeTimeline(timeline: Timeline): string[] {
  const issues: string[] = [];
  const base = timeline.segments.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  const overlays = timeline.segments.filter(isOverlay);
  for (const s of base) {
    if (s.duration > MAX_BEAT_SECONDS + EPS) issues.push(`Shot at ${r1(s.start)}s holds ${r1(s.duration)}s; keep beats to ${MAX_BEAT_SECONDS}s or less.`);
    const end = s.start + s.duration;
    const captions = overlays.filter((o) => o.style === "caption" && o.start < end - EPS && o.start + o.duration > s.start + EPS);
    if (captions.length > 1) issues.push(`Shot at ${r1(s.start)}s carries ${captions.length} captions; use at most one per beat.`);
  }
  for (const o of overlays) {
    if (o.style === "brand" && o.duration > MAX_OUTRO_SECONDS + EPS) {
      issues.push(`Logo close at ${r1(o.start)}s lasts ${r1(o.duration)}s; keep it to ${MAX_OUTRO_SECONDS}s or less.`);
    }
  }
  return issues;
}

/**
 * Share of the bright (app screen) area of a greyscale frame that sits in big empty blocks: flat cells whose
 * whole neighbourhood (`span` cells each way) is flat and bright too. Margins, gaps between list rows and
 * padding are thin, so they don't count; a camera view that never loaded or a half-empty list does.
 * Returns 0 when the frame has almost no bright area (dark apps, title cards).
 */
export function blankShare(gray: Uint8Array, width: number, height: number, cell = 8, span = 2): number {
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  const flat = new Uint8Array(cols * rows);
  let bright = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let sq = 0;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const v = gray[(r * cell + dy) * width + c * cell + dx]!;
          sum += v;
          sq += v * v;
        }
      }
      const n = cell * cell;
      const mean = sum / n;
      if (mean < 170) continue;
      bright++;
      if (sq / n - mean * mean < 4) flat[r * cols + c] = 1;
    }
  }
  if (bright < 20) return 0;
  let empty = 0;
  for (let r = span; r < rows - span; r++) {
    for (let c = span; c < cols - span; c++) {
      let all = true;
      for (let dr = -span; dr <= span && all; dr++) for (let dc = -span; dc <= span && all; dc++) all = flat[(r + dr) * cols + c + dc] === 1;
      if (all) empty++;
    }
  }
  return empty / bright;
}

const FPS = 2;

/** Blank-share of each sampled frame of a video, FPS times a second. */
async function blankShares(file: string, width: number): Promise<number[]> {
  const { stdout: dims } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
  const [vw, vh] = dims.trim().split(",").map(Number) as [number, number];
  const h = Math.max(8, Math.round((width * vh) / vw / 8) * 8);
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${FPS},scale=${width}:${h},format=gray`, "-f", "rawvideo", "-"], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  const size = width * h;
  const out: number[] = [];
  for (let i = 0; i + size <= stdout.length; i += size) out.push(blankShare(new Uint8Array(stdout.buffer, stdout.byteOffset + i, size), width, h));
  return out;
}

/** Runs of samples over the blank limit, at least two samples long (one alone can be a crossfade). */
export function blankRuns(shares: number[], fps = FPS): Span[] {
  const spans: Span[] = [];
  let from = -1;
  for (let i = 0; i <= shares.length; i++) {
    if (i < shares.length && shares[i]! > MAX_BLANK_SHARE) {
      if (from < 0) from = i;
    } else if (from >= 0) {
      if (i - from >= 2) spans.push({ start: from / fps, duration: (i - from) / fps });
      from = -1;
    }
  }
  return spans;
}

/**
 * Stretches of a screen recording where the app screen is mostly empty; the editor treats them as dead time,
 * so no header or search shot lands on them. Checked on the source clip, where the screen fills the frame.
 */
export async function blankSpans(file: string): Promise<Span[]> {
  return blankRuns(await blankShares(file, 240));
}

