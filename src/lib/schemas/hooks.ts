import { z } from "zod";

export const HookFormat = z.enum(["pov", "problem", "before_after", "list", "question"]);

export const MAX_HOOK_WORDS = 8;
export const fitsWordLimit = (text: string, max = MAX_HOOK_WORDS) => text.trim().split(/\s+/).length <= max;

export const Hook = z.object({
  text: z.string().refine((t) => fitsWordLimit(t), `${MAX_HOOK_WORDS} words or fewer`),
  format: HookFormat,
});
export type Hook = z.infer<typeof Hook>;

/** A hook as the model wrote it, before the word limit is checked. */
export const HookDraft = z.object({ text: z.string(), format: HookFormat });
export type HookDraft = z.infer<typeof HookDraft>;

/**
 * What the model returns per call; the pipeline tops up to HOOK_COUNT across calls.
 * Lenient on length so one over-long hook is dropped and re-asked for, rather than failing the batch.
 */
export const HookSet = z.object({ hooks: z.array(HookDraft).min(1).max(10) });
export type HookSet = z.infer<typeof HookSet>;

export const HOOK_COUNT = 10;
export const MAX_SOCIAL_HOOKS = 5;

/** The user's picks: up to 5 hooks for social ads and one headline for the App Store videos. */
export const ChosenHooks = z.object({
  social: z.array(z.string()).max(MAX_SOCIAL_HOOKS),
  headline: z.string().nullable(),
});
export type ChosenHooks = z.infer<typeof ChosenHooks>;
