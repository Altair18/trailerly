import { z } from "zod";

export const SegmentType = z.enum(["screen", "ai_scene", "text", "end_card"]);
export type SegmentType = z.infer<typeof SegmentType>;

export const Segment = z.object({
  type: SegmentType,
  start: z.number().min(0),
  duration: z.number().positive(),
  clip_id: z.string().optional(),
  prompt: z.string().optional(),
  text: z.string().optional(),
});
export type Segment = z.infer<typeof Segment>;

export const Timeline = z.object({
  segments: z.array(Segment).min(1),
  /** Voiceover script for social ads; App Store videos have none by default. */
  voiceover: z.string().optional(),
});
export type Timeline = z.infer<typeof Timeline>;
