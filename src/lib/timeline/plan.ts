import type { Brief } from "@/lib/schemas/brief";
import type { Clip } from "@/lib/schemas/clips";
import { SCREENSHOT_SECONDS, type Screenshot } from "@/lib/media/screenshots";
import { isPrivate } from "@/lib/schemas/clips";
import type { OutputSpec } from "@/lib/specs/outputs";
import { enforceSpec } from "./enforce";
import { fallbackTimeline } from "./preview";
import type { Timeline } from "./schema";
import { buildFromTemplate, templatePrompt, templatesFor, type TemplateFill } from "./templates";
import type { Tier } from "@/lib/llm/claude";

export interface PlanContext {
  brief: Brief;
  headline: string | null;
  socialHook?: string | null;
  clips: Pick<Clip, "id" | "duration" | "notes" | "idle">[];
  /** App Store screenshots, for when footage is missing, short or private. */
  screenshots?: Pick<Screenshot, "id" | "notes">[];
  /** Templates used by sibling outputs in this pack, skipped while others are left (variety). */
  avoidTemplates?: string[];
}

/** One model call: the prompt and which tier answers it. */
export type Generate = (prompt: string, tier: Tier) => Promise<TemplateFill>;

/** The fast model fills the template first; a plan that fails the checks gets one retry on the main model. */
export const PLAN_TIERS: Tier[] = ["fast", "smart"];

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
 * Plan an output from a template: the fast model picks a template and fills it, code builds the timeline and
 * checks it against the spec. Errors go back with one retry on the main model, and if that fails too the
 * code-built cut is used so the pack never blocks on the model.
 */
export async function planTimeline(
  spec: OutputSpec,
  ctx: PlanContext,
  generate: Generate,
): Promise<{ timeline: Timeline; source: Tier | "fallback"; attempts: number; errors: string[] }> {
  ctx = { ...ctx, clips: safeClips(ctx.clips, spec, (ctx.screenshots?.length ?? 0) * SCREENSHOT_SECONDS) };
  const clipSeconds = Object.fromEntries(ctx.clips.map((c) => [c.id, c.duration]));
  const imageIds = (ctx.screenshots ?? []).map((s) => s.id);
  const hook = ctx.socialHook ?? ctx.headline;
  const templates = templatesFor(spec, ctx.avoidTemplates);
  const fillCtx = { hook, clips: ctx.clips, screenshots: ctx.screenshots, brief: ctx.brief };
  let feedback = "";
  const seen: string[] = [];
  for (const [i, tier] of PLAN_TIERS.entries()) {
    try {
      const fill = await generate(templatePrompt(spec, fillCtx, templates, feedback), tier);
      const template = templates.find((t) => t.id === fill.template_id);
      if (!template) throw new Error(`Unknown template "${fill.template_id}"; pick one of ${templates.map((t) => t.id).join(", ")}.`);
      const built = buildFromTemplate(template, fill, spec, fillCtx);
      const errors = built.timeline ? enforceSpec(built.timeline, spec, clipSeconds, imageIds) : built.errors;
      if (built.timeline && errors.length === 0) {
        return { timeline: { ...built.timeline, planned_by: tier }, source: tier, attempts: i + 1, errors: seen };
      }
      feedback = errors.join(" ");
    } catch (err) {
      feedback = `Your reply could not be used: ${(err as Error).message}`;
    }
    seen.push(feedback);
  }
  const timeline = fallbackTimeline(ctx.clips, hook, spec, ctx.screenshots);
  return { timeline: { ...timeline, planned_by: "fallback" }, source: "fallback", attempts: PLAN_TIERS.length, errors: seen };
}
