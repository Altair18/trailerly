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
