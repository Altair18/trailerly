import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Segment, Timeline } from "@/lib/timeline/schema";

// Agency previews push in on the part of the screen where something happens (a tap, a list filling, a result
// appearing). We find that part from the footage itself: where consecutive frames differ most during the shot.

const run = promisify(execFile);

/** Low-res grey frames of a clip, sampled a few times a second. */
export interface MotionFrames {
  w: number;
  h: number;
  fps: number;
  frames: Uint8Array[];
}

export interface Focus {
  /** Centre of the action, as shares of the frame (0 to 1). */
  x: number;
  y: number;
  /** How far to push in by the end of the shot (1 = not at all). */
  zoom: number;
}

const W = 24;
const H = 52;
const SAMPLE_FPS = 4;
/** The push: subtle, so the UI stays readable and nothing important leaves the frame. */
const ZOOM = 1.12;

export async function motionFrames(url: string): Promise<MotionFrames> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", url, "-vf", `fps=${SAMPLE_FPS},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  const buf = new Uint8Array(stdout);
  const frames: Uint8Array[] = [];
  for (let i = 0; i + W * H <= buf.length; i += W * H) frames.push(buf.subarray(i, i + W * H));
  return { w: W, h: H, fps: SAMPLE_FPS, frames };
}

/**
 * Where the action is between `from` and `to` seconds: the motion-weighted centre, when the motion is concentrated
 * in one part of the screen. A whole-screen change (a scroll, a new page) gives no focus: pushing in there would
 * only crop the UI.
 */
export function focusFrom(m: MotionFrames, from: number, to: number): Focus | null {
  const a = Math.max(1, Math.floor(from * m.fps));
  const b = Math.min(m.frames.length - 1, Math.ceil(to * m.fps));
  if (b <= a) return null;
  const heat = new Float64Array(m.w * m.h);
  for (let f = a; f <= b; f++) {
    const p = m.frames[f - 1]!;
    const q = m.frames[f]!;
    for (let i = 0; i < heat.length; i++) {
      const d = Math.abs(q[i]! - p[i]!);
      if (d > 12) heat[i]! += d;
    }
  }
  const total = heat.reduce((n, v) => n + v, 0);
  if (total < 200) return null;
  // Concentrated: the busiest fifth of the screen holds most of the change.
  const sorted = [...heat].sort((x, y) => y - x);
  const top = sorted.slice(0, Math.ceil(heat.length / 5)).reduce((n, v) => n + v, 0);
  if (top / total < 0.7) return null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < heat.length; i++) {
    x += (heat[i]! * ((i % m.w) + 0.5)) / m.w;
    y += (heat[i]! * (Math.floor(i / m.w) + 0.5)) / m.h;
  }
  // Keep the centre away from the edges, so the push never shows past the screen.
  const clamp = (v: number) => Math.min(0.75, Math.max(0.25, v));
  return { x: Math.round(clamp(x / total) * 100) / 100, y: Math.round(clamp(y / total) * 100) / 100, zoom: ZOOM };
}

/** Add a focus to each recording shot whose action sits in one part of the screen. */
export function withFocus(timeline: Timeline, motion: Record<string, MotionFrames>): Timeline {
  return {
    ...timeline,
    segments: timeline.segments.map((s): Segment => {
      const m = s.type === "screen" && s.clip_id ? motion[s.clip_id] : undefined;
      const focus = m ? focusFrom(m, s.clip_offset ?? 0, (s.clip_offset ?? 0) + s.duration) : null;
      return focus ? { ...s, focus } : s;
    }),
  };
}
