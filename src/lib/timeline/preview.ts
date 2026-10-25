import { rankClips } from "@/lib/media/analyse";
import type { Clip } from "@/lib/schemas/clips";
import type { OutputSpec } from "@/lib/specs/outputs";
import { MAX_OVERLAY_WORDS, readSeconds } from "./enforce";
import type { Segment, Timeline } from "./schema";

export const HEADLINE_SECONDS = 3;
export const BRAND_SECONDS = 2.5;
const round = (n: number) => Math.round(n * 100) / 100;

/** Trim a headline to an on-screen line: the first few words, cut at a natural break if there is one. */
export function shortLine(text: string, maxWords = MAX_OVERLAY_WORDS): string {
  const first = text.split(/[.!?:;\u2014]|\s[-\u2013]\s/)[0]!.trim();
  const words = first.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ").replace(/[,]$/, "");
}

/**
 * A safe App Store preview built in code: the best clips back to back (trimmed to the spec's
 * length), the headline over the opening seconds, and the app's name over the end.
 * Used when the model's plan keeps failing.
 */
export function fallbackPreview(clips: Pick<Clip, "id" | "duration" | "notes">[], headline: string | null, spec: OutputSpec): Timeline {
  const usable = rankClips(clips);
  const clean = usable.filter((c) => !c.notes?.personal_info);
  const pool = clean.reduce((n, c) => n + c.duration, 0) >= spec.minSeconds ? clean : usable;
  const target = Math.min(spec.maxSeconds, pool.reduce((n, c) => n + c.duration, 0));
  const segments: Segment[] = [];
  let t = 0;
  for (const clip of pool) {
    if (t >= target) break;
    const duration = round(Math.min(clip.duration, target - t));
    if (duration < 0.5) break;
    segments.push({ type: "screen", start: round(t), duration, clip_id: clip.id, clip_offset: 0 });
    t += duration;
  }
  if (headline) {
    const line = shortLine(headline);
    segments.push({ type: "text", overlay: true, style: "hook", start: 0, duration: Math.max(HEADLINE_SECONDS, readSeconds(line)), text: line });
  }
  if (t >= HEADLINE_SECONDS + BRAND_SECONDS + 1) {
    segments.push({ type: "text", overlay: true, style: "brand", start: round(t - BRAND_SECONDS), duration: BRAND_SECONDS });
  }
  return { segments };
}
