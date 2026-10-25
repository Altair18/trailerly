import { z } from "zod";

export const HookFormat = z.enum(["pov", "problem", "before_after", "list", "question"]);

export const MAX_HOOK_WORDS = 8;
export const hookWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const Hook = z.object({
  text: z.string().refine((t) => hookWords(t) <= MAX_HOOK_WORDS, `${MAX_HOOK_WORDS} words or fewer`),
  format: HookFormat,
});
export type Hook = z.infer<typeof Hook>;

/**
 * What the model returns per call. Lenient on length on purpose: one over-long hook must not
 * throw away the whole batch; collectHooks drops it and tells the model on the next round.
 */
export const HookSet = z.object({ hooks: z.array(z.object({ text: z.string(), format: HookFormat })).min(1).max(20) });
export type HookSet = z.infer<typeof HookSet>;

export const HOOK_COUNT = 10;
export const MAX_SOCIAL_HOOKS = 5;

/** The user's picks: up to 5 hooks for social ads and one headline for the App Store videos. */
export const ChosenHooks = z.object({
  social: z.array(z.string()).max(MAX_SOCIAL_HOOKS),
  headline: z.string().nullable(),
});
export type ChosenHooks = z.infer<typeof ChosenHooks>;
