import type { Brief } from "@/lib/schemas/brief";
import type { Clip } from "@/lib/schemas/clips";
import { SCREENSHOT_SECONDS, type Screenshot } from "@/lib/media/screenshots";
import { isPrivate } from "@/lib/schemas/clips";
import { MAX_OVERLAY_WORDS } from "./enforce";
import type { OutputSpec } from "@/lib/specs/outputs";
import { enforceSpec } from "./enforce";
import { fallbackTimeline } from "./preview";
import type { Timeline } from "./schema";

export const MAX_REPLANS = 2;

export interface PlanContext {
  brief: Brief;
  headline: string | null;
  socialHook?: string | null;
  clips: Pick<Clip, "id" | "duration" | "notes" | "idle">[];
  /** App Store screenshots, for when footage is missing, short or private. */
  screenshots?: Pick<Screenshot, "id" | "notes">[];
}

export type Generate = (prompt: string) => Promise<Timeline>;

export const PLANNER_SYSTEM = `You edit short app videos. You plan them as a timeline of segments.
Each segment: {"type": "screen" | "screenshot" | "ai_scene" | "text" | "end_card", "start": seconds, "duration": seconds,
"clip_id": for screen, "image_id": for screenshot, "clip_offset": seconds into the clip (default 0), "prompt": for ai_scene, "text": for text and end_card,
"overlay": true for text drawn over the segment underneath, "style": "hook" | "caption" | "brand" for overlays}.

Story: open on the strongest moment with a "hook" overlay (the promise, 0 to 3 s), then 2 to 4 feature beats, each a
screen segment with a "caption" overlay naming what the viewer is seeing, and finish with a "brand" overlay
(app icon and name, no text needed) over the last 2 to 3 seconds. Where the spec allows end_card, end on one instead.

On-screen text is written for video, not copied from the listing: ${MAX_OVERLAY_WORDS} words at most, plain and
concrete ("Snap a photo, get an answer"), in the brief's tone. Each line stays up for at least 0.3 s per word
(minimum 1.2 s), lines never overlap, and each caption starts with the screen segment it describes.

Clips: each comes with a label, the feature it shows and an interest score (1 to 5). Use the highest-interest clips,
match captions to what the clip shows, and you may use part of a clip (clip_offset + duration) to skip slow bits.
A clip's dead_time lists stretches where nothing moves on screen ({start, duration} in seconds): leave them out.
Never use a clip marked personal_info unless there is no other way to reach the minimum length.

Screenshots: still App Store screenshots, animated for you. Use them (2 to 4 s each, with a caption) only when the
clips are missing, too short to reach the minimum length, or private. Real clips always come first.

Header and search (landscape App Store videos, new in iOS 27): the phone recording is shown on a stage beside your
text, so keep them short and simple: aim for target_seconds, one hook line held over the first 3 to 5 s, then 1 or 2
caption beats, and the brand overlay last. The header loops, so end on a calm moment that cuts cleanly back to the
start. The search video is always muted and shown small in results, so the first 2 seconds must be the best moment.

Rules: the non-overlay segments play back to back from 0 with no gaps or overlaps. A screen segment must not run past
the end of its clip (clip_offset + duration <= clip length). Only use segment types the spec allows.
Return JSON: {"segments": [...]}.`;

export function plannerPrompt(spec: OutputSpec, ctx: PlanContext, feedback: string): string {
  return JSON.stringify({
    output: {
      name: spec.label,
      seconds: [spec.minSeconds, spec.maxSeconds],
      target_seconds: spec.targetSeconds,
      loops: spec.loop || undefined,
      allowed_segments: spec.allowedSegments,
      max_ai_seconds: spec.maxAiSeconds,
      min_real_screen_share: spec.minScreenShare,
      sound: spec.sound,
    },
    headline: ctx.headline,
    hook: ctx.socialHook ?? undefined,
    brief: ctx.brief,
    clips: ctx.clips.map((c) => ({
      clip_id: c.id,
      seconds: c.duration,
      shows: c.notes?.label,
      feature: c.notes?.feature ?? undefined,
      interest: c.notes?.interest,
      personal_info: isPrivate(c.notes) || undefined,
      dead_time: c.idle?.length ? c.idle : undefined,
    })),
    screenshots: ctx.screenshots?.length
      ? ctx.screenshots.map((s) => ({ image_id: s.id, shows: s.notes?.label, feature: s.notes?.feature ?? undefined, interest: s.notes?.interest }))
      : undefined,
    fix_these_errors_from_your_last_plan: feedback || undefined,
  });
}

/**
 * Clips the planner may use: clips that still show personal data are left out whenever the clean ones
 * (plus any screenshots) reach the spec's minimum length. Otherwise all stay in and the prompt marks the private ones.
 */
export function safeClips<T extends Pick<Clip, "id" | "duration" | "notes">>(
  clips: T[],
  spec: Pick<OutputSpec, "minSeconds">,
  extraSeconds = 0,
): T[] {
  const clean = clips.filter((c) => !isPrivate(c.notes));
  return clean.reduce((n, c) => n + c.duration, 0) + extraSeconds >= spec.minSeconds ? clean : clips;
}

/**
 * Ask the model for a timeline, check it in code, and re-ask with the errors up to MAX_REPLANS times.
 * App Store outputs fall back to a code-built timeline so they never block the pack.
 */
export async function planTimeline(
  spec: OutputSpec,
  ctx: PlanContext,
  generate: Generate,
): Promise<{ timeline: Timeline; source: "model" | "fallback"; attempts: number }> {
  ctx = { ...ctx, clips: safeClips(ctx.clips, spec, (ctx.screenshots?.length ?? 0) * SCREENSHOT_SECONDS) };
  const clipSeconds = Object.fromEntries(ctx.clips.map((c) => [c.id, c.duration]));
  const imageIds = (ctx.screenshots ?? []).map((s) => s.id);
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_REPLANS + 1; attempt++) {
    try {
      const timeline = await generate(plannerPrompt(spec, ctx, feedback));
      const errors = enforceSpec(timeline, spec, clipSeconds, imageIds);
      if (errors.length === 0) return { timeline, source: "model", attempts: attempt };
      feedback = errors.join(" ");
    } catch (err) {
      feedback = `Your reply could not be read: ${(err as Error).message}`;
    }
  }
  // App Store outputs fall back to a code-built cut so the pack never blocks on the model.
  if (spec.placement === "appstore") {
    return { timeline: fallbackTimeline(ctx.clips, ctx.headline, spec, ctx.screenshots), source: "fallback", attempts: MAX_REPLANS + 1 };
  }
  throw new Error(`Couldn't plan a valid ${spec.label} timeline: ${feedback}`);
}
