import { z } from "zod";

export const HookFormat = z.enum(["pov", "problem", "before_after", "list", "question"]);

export const Hook = z.object({
  text: z.string().refine((t) => t.trim().split(/\s+/).length <= 8, "8 words or fewer"),
  format: HookFormat,
});
export type Hook = z.infer<typeof Hook>;

/** What the model returns per call; the pipeline tops up to HOOK_COUNT across calls. */
export const HookSet = z.object({ hooks: z.array(Hook).min(1).max(10) });
export type HookSet = z.infer<typeof HookSet>;

export const HOOK_COUNT = 10;
export const MAX_SOCIAL_HOOKS = 5;

/** The user's picks: up to 5 hooks for social ads and one headline for the App Store videos. */
export const ChosenHooks = z.object({
  social: z.array(z.string()).max(MAX_SOCIAL_HOOKS),
  headline: z.string().nullable(),
});
export type ChosenHooks = z.infer<typeof ChosenHooks>;
