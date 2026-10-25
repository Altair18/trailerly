import { rankClips } from "@/lib/media/analyse";
import { SCREENSHOT_SECONDS, type Screenshot } from "@/lib/media/screenshots";
import { type Clip, isPrivate, liveRange } from "@/lib/schemas/clips";
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
 * length), topped up with App Store screenshots when there isn't enough clean footage, the
 * headline over the opening seconds, and the app's name over the end.
 * Used when the model's plan keeps failing.
 */
export function fallbackTimeline(
  clips: Pick<Clip, "id" | "duration" | "notes" | "idle">[],
  headline: string | null,
  spec: OutputSpec,
  screenshots: Pick<Screenshot, "id" | "notes">[] = [],
): Timeline {
  const ranked = rankClips(clips);
  const clean = ranked.filter((c) => !isPrivate(c.notes));
  const shots = rankClips(screenshots);
  const cleanSeconds = clean.reduce((n, c) => n + c.duration, 0);
  const shotSeconds = shots.length * SCREENSHOT_SECONDS;
  // Prefer clean footage + screenshots; fall back to private clips only when that's still too short.
  const pool = cleanSeconds + shotSeconds >= spec.minSeconds || ranked.length === clean.length ? clean : ranked;
  const limit = Math.min(spec.maxSeconds, spec.targetSeconds);
  // Skip dead time when the footage left still reaches the minimum length.
  const live = pool.map((c) => ({ id: c.id, ...liveRange(c) }));
  const trimmed = live.reduce((n, c) => n + c.duration, 0) + shotSeconds >= spec.minSeconds;
  const cuts = trimmed ? live : pool.map((c) => ({ id: c.id, offset: 0, duration: c.duration }));
  const segments: Segment[] = [];
  let t = 0;
  for (const clip of cuts) {
    if (t >= limit) break;
    const duration = round(Math.min(clip.duration, limit - t));
    if (duration < 0.5) break;
    segments.push({ type: "screen", start: round(t), duration, clip_id: clip.id, clip_offset: clip.offset });
    t += duration;
  }
  // Top up to the minimum (or show a few if there's no footage at all) with screenshots.
  const wanted = pool.length === 0 ? Math.max(spec.minSeconds, Math.min(limit, shotSeconds)) : spec.minSeconds;
  for (let i = 0; t < wanted - 0.01 && shots.length > 0; i++) {
    const duration = round(Math.min(SCREENSHOT_SECONDS, limit - t));
    if (duration < 0.5) break;
    segments.push({ type: "screenshot", start: round(t), duration, image_id: shots[i % shots.length]!.id });
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

/** @deprecated name kept for callers written before header and search used the fallback too. */
export const fallbackPreview = fallbackTimeline;
