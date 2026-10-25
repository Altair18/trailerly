import type { Clip } from "@/lib/schemas/clips";
import type { Timeline } from "./schema";

const EPS = 0.05;

/**
 * Move each screen segment's start out of dead time (a frozen, loading or black stretch of its clip) when the
 * clip has room to play the same length from the end of that stretch. Timing, overlays and order stay the same,
 * so a plan that passed the spec still passes it.
 */
export function skipDeadStarts(timeline: Timeline, clips: Pick<Clip, "id" | "duration" | "idle">[]): Timeline {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const segments = timeline.segments.map((s) => {
    if (s.type !== "screen" || s.overlay || !s.clip_id) return s;
    const clip = byId.get(s.clip_id);
    if (!clip?.idle?.length) return s;
    let offset = s.clip_offset ?? 0;
    for (const span of [...clip.idle].sort((a, b) => a.start - b.start)) {
      const end = span.start + span.duration;
      if (offset >= span.start - EPS && offset < end - EPS && end + s.duration <= clip.duration + EPS) offset = end;
    }
    return offset === (s.clip_offset ?? 0) ? s : { ...s, clip_offset: Math.round(offset * 100) / 100 };
  });
  return { ...timeline, segments };
}
