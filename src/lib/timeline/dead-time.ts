import type { Clip } from "@/lib/schemas/clips";
import type { Timeline } from "./schema";

const EPS = 0.05;

type Span = { start: number; duration: number };

/** Seconds of [from, from + length) that fall inside the clip's dead time. */
function deadOverlap(idle: Span[], from: number, length: number): number {
  const to = from + length;
  return idle.reduce((n, s) => n + Math.max(0, Math.min(to, s.start + s.duration) - Math.max(from, s.start)), 0);
}

/**
 * Move each screen segment's window off dead time (a frozen, loading or black stretch of its clip). The segment
 * keeps its length; only where it starts in the clip changes. Candidate starts are the planned one, the clip's
 * start, the end of each dead stretch and the point that ends just before one; the one with the least dead time
 * wins, ties going to the start closest to the plan. Timing, overlays and order stay the same, so a plan that
 * passed the spec still passes it.
 */
export function avoidDeadTime(timeline: Timeline, clips: Pick<Clip, "id" | "duration" | "idle">[]): Timeline {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const segments = timeline.segments.map((s) => {
    if (s.type !== "screen" || s.overlay || !s.clip_id) return s;
    const clip = byId.get(s.clip_id);
    if (!clip?.idle?.length) return s;
    const planned = s.clip_offset ?? 0;
    const plannedDead = deadOverlap(clip.idle, planned, s.duration);
    if (plannedDead <= EPS) return s;
    const latest = clip.duration - s.duration;
    const candidates = [0, ...clip.idle.flatMap((d) => [d.start + d.duration, d.start - s.duration])].filter(
      (o) => o >= 0 && o <= latest + EPS,
    );
    let best = planned;
    let bestDead = plannedDead;
    for (const o of candidates) {
      const dead = deadOverlap(clip.idle, o, s.duration);
      const better = dead < bestDead - EPS || (Math.abs(dead - bestDead) <= EPS && Math.abs(o - planned) < Math.abs(best - planned));
      if (better && dead < plannedDead - EPS) {
        best = o;
        bestDead = dead;
      }
    }
    if (best === planned) return s;
    return { ...s, clip_offset: Math.round(Math.min(best, latest) * 100) / 100 };
  });
  return { ...timeline, segments };
}
