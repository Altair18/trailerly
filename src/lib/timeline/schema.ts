import { z } from "zod";

export const SegmentType = z.enum(["screen", "ai_scene", "text", "end_card"]);
export type SegmentType = z.infer<typeof SegmentType>;

export const Segment = z.object({
  type: SegmentType,
  start: z.number().min(0),
  duration: z.number().positive(),
  clip_id: z.string().optional(),
  /** Seconds into the clip to start from (screen segments). */
  clip_offset: z.number().min(0).optional(),
  prompt: z.string().optional(),
  text: z.string().optional(),
  /** Text drawn over whatever is underneath, rather than a full-screen card. */
  overlay: z.boolean().optional(),
  /**
   * How an overlay looks: "hook" = big line near the top (the opening promise),
   * "caption" = short line in the lower third naming what's on screen,
   * "brand" = app icon and name over the last seconds (text optional).
   */
  style: z.enum(["hook", "caption", "brand"]).optional(),
});
export type Segment = z.infer<typeof Segment>;

export const Timeline = z.object({
  segments: z.array(Segment).min(1),
  /** Voiceover script for social ads; App Store videos have none by default. */
  voiceover: z.string().optional(),
});
export type Timeline = z.infer<typeof Timeline>;
