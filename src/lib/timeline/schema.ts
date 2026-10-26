import { z } from "zod";

export const SegmentType = z.enum(["screen", "screenshot", "ai_scene", "text", "end_card"]);
export type SegmentType = z.infer<typeof SegmentType>;

export const Segment = z.object({
  type: SegmentType,
  start: z.number().min(0),
  duration: z.number().positive(),
  clip_id: z.string().optional(),
  /** App Store screenshot to show (screenshot segments), e.g. "shot_2". */
  image_id: z.string().optional(),
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
  /** Screenshot segments: shares of the image cut off the top and bottom (the screenshot's own headline). */
  crop: z.object({ top: z.number().min(0).max(0.6).optional(), bottom: z.number().min(0).max(0.6).optional() }).optional(),
});
export type Segment = z.infer<typeof Segment>;

export const Timeline = z.object({
  segments: z.array(Segment).min(1),
  /** Voiceover script for social ads; App Store videos have none by default. */
  voiceover: z.string().optional(),
  /** The cut template the plan was built from, so results can be compared per template later. */
  template: z.string().optional(),
  /** Which planner produced it: the fast model, the main model on retry, or the code fallback. */
  planned_by: z.enum(["fast", "smart", "fallback"]).optional(),
});
export type Timeline = z.infer<typeof Timeline>;
