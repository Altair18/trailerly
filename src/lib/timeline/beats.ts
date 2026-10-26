import type { BeatGrid } from "@/lib/media/music";
import { isOverlay, readSeconds } from "./enforce";
import type { Segment, Timeline } from "./schema";

// Agency previews cut on the music's beat. Once a pack's bed is chosen, each cut between shots moves to the nearest
// beat when that's a small nudge and both shots keep the time to read their text (and the footage to fill it).

const EPS = 0.02;
const round = (n: number) => Math.round(n * 1000) / 1000;

export interface SnapOptions {
  /** Furthest a cut may move, in seconds. */
  maxShift?: number;
  /** Clip id -> length, so a shot never runs past its footage. */
  clipSeconds?: Record<string, number>;
  /** A second no cut may land near (the preview's poster frame), and how near. */
  avoid?: { at: number; clear: number };
}

/** The beat nearest `t`. */
export function nearestBeat(t: number, grid: BeatGrid): number {
  const p = 60 / grid.bpm;
  return grid.beat0 + Math.round((t - grid.beat0) / p) * p;
}

export function snapCutsToBeats(timeline: Timeline, grid: BeatGrid, opts: SnapOptions = {}): Timeline {
  const maxShift = opts.maxShift ?? 0.35;
  const segs: Segment[] = timeline.segments.map((s) => ({ ...s }));
  const base = segs.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  const overlays = segs.filter(isOverlay);
  const end = base.length ? base[base.length - 1]!.start + base[base.length - 1]!.duration : 0;
  // Least time a shot needs: the text over it must stay up long enough to read.
  const least = (s: Segment) => {
    const over = overlays.filter((o) => Math.abs(o.start - s.start) < EPS && Math.abs(o.duration - s.duration) < EPS);
    return Math.max(1.2, ...over.map((o) => (o.text?.trim() ? readSeconds(o.text) : 0)));
  };
  const fits = (s: Segment, duration: number) =>
    s.type !== "screen" || !s.clip_id || !opts.clipSeconds?.[s.clip_id] || (s.clip_offset ?? 0) + duration <= opts.clipSeconds[s.clip_id]! + EPS;

  for (let k = 1; k < base.length; k++) {
    const prev = base[k - 1]!;
    const next = base[k]!;
    const cut = next.start;
    const target = nearestBeat(cut, grid);
    const shift = target - cut;
    if (Math.abs(shift) < EPS || Math.abs(shift) > maxShift || target <= prev.start || target >= end - 0.5) continue;
    if (opts.avoid && Math.abs(target - opts.avoid.at) < opts.avoid.clear) continue;
    const prevLen = prev.duration + shift;
    const nextLen = next.duration - shift;
    if (prevLen < least(prev) - EPS || nextLen < least(next) - EPS || !fits(prev, prevLen) || !fits(next, nextLen)) continue;
    // The text that ends or starts at this cut moves with it.
    for (const o of overlays) {
      if (Math.abs(o.start + o.duration - cut) < EPS) o.duration = round(o.duration + shift);
      else if (Math.abs(o.start - cut) < EPS) {
        o.start = round(target);
        o.duration = round(o.duration - shift);
      }
    }
    prev.duration = round(prevLen);
    next.start = round(target);
    next.duration = round(nextLen);
  }
  return { ...timeline, segments: segs };
}
