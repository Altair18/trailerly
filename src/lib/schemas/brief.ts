import { z } from "zod";

export const Brief = z.object({
  what_it_does: z.string(),
  audience: z.string(),
  features: z.array(z.string()).min(3).max(5),
  review_phrases: z
    .array(z.string().refine((p) => p.trim().split(/\s+/).length <= 8, "8 words or fewer"))
    .max(10),
  tone: z.string(),
});
export type Brief = z.infer<typeof Brief>;

/** The brief as the model wrote it: review phrases aren't length-checked yet, so one long phrase can't fail the step. */
export const BriefDraft = Brief.extend({ review_phrases: z.array(z.string()) });
export type BriefDraft = z.infer<typeof BriefDraft>;
