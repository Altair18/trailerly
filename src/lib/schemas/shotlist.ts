import { z } from "zod";

export const MAX_SHOT_WORDS = 10;

/** One thing to film, in order. */
export const Shot = z.object({
  /** What to do on screen, as an instruction: "Add a coffee expense in one tap". */
  action: z.string(),
  /** Roughly how long to hold it (seconds). */
  seconds: z.number().min(1).max(10),
  /** The brief feature it shows, if any. */
  feature: z.string().nullable().optional(),
});
export type Shot = z.infer<typeof Shot>;

/** The model's reply, read leniently: shots that are too long are dropped in code. */
export const ShotListReply = z.object({ shots: z.array(Shot).max(12) });

export const ShotList = z.object({ shots: z.array(Shot).min(1).max(6) });
export type ShotList = z.infer<typeof ShotList>;
