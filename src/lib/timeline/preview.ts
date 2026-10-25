import type { Clip } from "@/lib/schemas/clips";
import type { OutputSpec } from "@/lib/specs/outputs";
import type { Segment, Timeline } from "./schema";

export const HEADLINE_SECONDS = 3;
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A safe App Store preview built in code: the clips back to back (trimmed to the spec's
 * length), with the headline over the opening seconds. Used when the model's plan keeps failing.
 */
export function fallbackPreview(clips: Pick<Clip, "id" | "duration">[], headline: string | null, spec: OutputSpec): Timeline {
  const target = Math.min(spec.maxSeconds, clips.reduce((n, c) => n + c.duration, 0));
  const segments: Segment[] = [];
  let t = 0;
  for (const clip of clips) {
    if (t >= target) break;
    const duration = round(Math.min(clip.duration, target - t));
    if (duration < 0.5) break;
    segments.push({ type: "screen", start: round(t), duration, clip_id: clip.id, clip_offset: 0 });
    t += duration;
  }
  if (headline) {
    segments.push({ type: "text", overlay: true, start: 0, duration: HEADLINE_SECONDS, text: headline });
  }
  return { segments };
}
