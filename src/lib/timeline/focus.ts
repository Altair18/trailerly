// Pure focus maths: shared by the worker and the Remotion bundle (no Node imports here).

/** Where on screen things change at a moment of a clip, as fractions of the frame. */
export interface FocusPoint {
  /** Seconds from the clip's start. */
  t: number;
  x: number;
  y: number;
  /** Share of the frame that changed (0 to 1); 0 means nothing moved. */
  amount: number;
}

/** Size of the grey frames the focus is read from: small is enough to find where things change. */
export const FOCUS_W = 36;
export const FOCUS_H = 72;
export const FOCUS_FPS = 5;

/**
 * Where the action is in each step of a clip: the centre of the pixels that changed since the last frame.
 * `frames` are grey frames of `w` x `h`, `fps` apart. A pixel counts when it changed by more than `threshold`
 * (0 to 255), which ignores compression noise.
 */
export function motionFocus(frames: Uint8Array[], w: number, h: number, fps: number, threshold = 18): FocusPoint[] {
  const out: FocusPoint[] = [];
  for (let f = 1; f < frames.length; f++) {
    const a = frames[f - 1]!;
    const b = frames[f]!;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (Math.abs(a[i]! - b[i]!) > threshold) {
          n++;
          sx += x;
          sy += y;
        }
      }
    }
    const amount = n / (w * h);
    out.push({ t: Math.round((f / fps) * 100) / 100, x: n ? (sx / n + 0.5) / w : 0.5, y: n ? (sy / n + 0.5) / h : 0.5, amount: Math.round(amount * 1000) / 1000 });
  }
  return out;
}

/** Below this share of changed pixels a step is noise; above the upper one it is a screen change, not a detail. */
const MIN_AMOUNT = 0.004;
const MAX_AMOUNT = 0.35;

/**
 * The point to zoom towards over [from, from + duration) of a clip: the motion-weighted centre of the steps
 * where something local changed. Null when nothing local moved (a still screen, or only full-screen changes),
 * so the shot plays unzoomed.
 */
export function focusFor(points: FocusPoint[] | undefined, from: number, duration: number): { x: number; y: number } | null {
  const steps = (points ?? []).filter((p) => p.t >= from && p.t <= from + duration && p.amount >= MIN_AMOUNT && p.amount <= MAX_AMOUNT);
  const weight = steps.reduce((n, p) => n + p.amount, 0);
  if (weight === 0) return null;
  return {
    x: steps.reduce((n, p) => n + p.x * p.amount, 0) / weight,
    y: steps.reduce((n, p) => n + p.y * p.amount, 0) / weight,
  };
}
