import type { ChosenHooks, Hook } from "@/lib/schemas/hooks";
import { readSeconds } from "./enforce";
import { HEADLINE_SECONDS, shortLine } from "./preview";
import type { Segment, Timeline } from "./schema";

// A/B set for Apple's Product Page Optimization: the same cut with a different opening hook, so the test
// measures the message and costs no extra model calls or AI scenes.

/** Hooks for variants B and C: the user's other picks first, then the remaining proposed hooks. */
export function variantHooks(chosen: Pick<ChosenHooks, "social" | "headline">, proposed: Pick<Hook, "text">[]): string[] {
  const seen = new Set<string>(chosen.headline ? [chosen.headline] : []);
  const out: string[] = [];
  for (const text of [...chosen.social, ...proposed.map((h) => h.text)]) {
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length === 2) break;
  }
  return out;
}

const isHook = (s: Segment) => s.overlay && s.style !== "caption" && s.style !== "brand";

/** The base timeline with its opening hook line swapped for `hook`, kept clear of the next overlay. */
export function withHook(timeline: Timeline, hook: string): Timeline {
  const line = shortLine(hook);
  const segments = timeline.segments.map((s) => ({ ...s }));
  let target = segments.find(isHook);
  if (!target) {
    target = { type: "text", overlay: true, style: "hook", start: 0, duration: HEADLINE_SECONDS, text: line };
    segments.push(target);
  }
  const nextStart = Math.min(
    ...segments.filter((s) => s.overlay && s !== target && s.start >= target!.start).map((s) => s.start),
    Math.max(...segments.filter((s) => !s.overlay).map((s) => s.start + s.duration), target.start + target.duration),
  );
  target.text = line;
  target.duration = Math.round(Math.max(0.5, Math.min(Math.max(target.duration, readSeconds(line)), nextStart - target.start)) * 100) / 100;
  return { ...timeline, segments };
}
