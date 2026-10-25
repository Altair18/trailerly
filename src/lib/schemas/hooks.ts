import { z } from "zod";

export const HookFormat = z.enum(["pov", "problem", "before_after", "list", "question"]);

export const Hook = z.object({
  text: z.string().refine((t) => t.trim().split(/\s+/).length <= 8, "8 words or fewer"),
  format: HookFormat,
});
export type Hook = z.infer<typeof Hook>;

export const HookSet = z.object({ hooks: z.array(Hook).length(10) });
export type HookSet = z.infer<typeof HookSet>;
