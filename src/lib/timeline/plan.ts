import type { Brief } from "@/lib/schemas/brief";
import type { Clip } from "@/lib/schemas/clips";
import type { OutputSpec } from "@/lib/specs/outputs";
import { enforceSpec } from "./enforce";
import { fallbackPreview } from "./preview";
import type { Timeline } from "./schema";

export const MAX_REPLANS = 2;

export interface PlanContext {
  brief: Brief;
  headline: string | null;
  socialHook?: string | null;
  clips: Pick<Clip, "id" | "duration">[];
}

export type Generate = (prompt: string) => Promise<Timeline>;

export const PLANNER_SYSTEM = `You plan short app videos as a timeline of segments.
Each segment: {"type": "screen" | "ai_scene" | "text" | "end_card", "start": seconds, "duration": seconds,
"clip_id": for screen, "clip_offset": seconds into the clip (default 0), "prompt": for ai_scene, "text": for text and end_card,
"overlay": true for text drawn over the segment underneath}.
Rules: the non-overlay segments play back to back from 0 with no gaps or overlaps. A screen segment must not run past
the end of its clip (clip_offset + duration <= clip length). Only use segment types the spec allows.
Use the clips in an order that shows the features in the brief, best first.
Return JSON: {"segments": [...]}.`;

export function plannerPrompt(spec: OutputSpec, ctx: PlanContext, feedback: string): string {
  return JSON.stringify({
    output: {
      name: spec.label,
      seconds: [spec.minSeconds, spec.maxSeconds],
      allowed_segments: spec.allowedSegments,
      max_ai_seconds: spec.maxAiSeconds,
      min_real_screen_share: spec.minScreenShare,
      sound: spec.sound,
    },
    headline: ctx.headline,
    hook: ctx.socialHook ?? undefined,
    brief: ctx.brief,
    clips: ctx.clips.map((c) => ({ clip_id: c.id, seconds: c.duration })),
    fix_these_errors_from_your_last_plan: feedback || undefined,
  });
}

/**
 * Ask the model for a timeline, check it in code, and re-ask with the errors up to MAX_REPLANS times.
 * The App Store preview falls back to a code-built timeline so it never blocks the pack.
 */
export async function planTimeline(
  spec: OutputSpec,
  ctx: PlanContext,
  generate: Generate,
): Promise<{ timeline: Timeline; source: "model" | "fallback"; attempts: number }> {
  const clipSeconds = Object.fromEntries(ctx.clips.map((c) => [c.id, c.duration]));
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_REPLANS + 1; attempt++) {
    try {
      const timeline = await generate(plannerPrompt(spec, ctx, feedback));
      const errors = enforceSpec(timeline, spec, clipSeconds);
      if (errors.length === 0) return { timeline, source: "model", attempts: attempt };
      feedback = errors.join(" ");
    } catch (err) {
      feedback = `Your reply could not be read: ${(err as Error).message}`;
    }
  }
  if (spec.id === "preview") {
    return { timeline: fallbackPreview(ctx.clips, ctx.headline, spec), source: "fallback", attempts: MAX_REPLANS + 1 };
  }
  throw new Error(`Couldn't plan a valid ${spec.label} timeline: ${feedback}`);
}
