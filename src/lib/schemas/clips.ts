import { z } from "zod";

/** A rectangle as fractions of the frame (0 to 1), top-left origin. */
export const Region = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type Region = z.infer<typeof Region>;

/** What Claude saw in a clip's frames. Best-effort: missing when the check couldn't run. */
export const ClipNotes = z.object({
  /** Short label for the action shown, e.g. "Attaches a photo". */
  label: z.string(),
  /** Which brief feature this clip shows, if any. */
  feature: z.string().nullable().optional(),
  /** 1 (dull: loading, idle, settings) to 5 (the app's best moment). */
  interest: z.number().int().min(1).max(5),
  /** True when the frames show personal data that isn't the app's own demo content. */
  personal_info: z.boolean(),
  /** What the personal data is, e.g. "real chat titles in a sidebar". */
  privacy_note: z.string().nullable().optional(),
  /** Where the personal data is, covering every frame shown. */
  private_regions: z.array(Region).optional(),
  /** True once those regions have been blurred in the stored clip. */
  blurred: z.boolean().optional(),
});
export type ClipNotes = z.infer<typeof ClipNotes>;

/** One clip cut from the recording, as stored in sources.clips_json. */
export const Clip = z.object({
  id: z.string(),
  start: z.number(),
  duration: z.number(),
  path: z.string(),
  poster_path: z.string(),
  notes: ClipNotes.optional(),
});
export type Clip = z.infer<typeof Clip>;
export const Clips = z.array(Clip);

/** Still shows personal data: flagged and not (yet) blurred. */
export const isPrivate = (notes?: ClipNotes | null) => Boolean(notes?.personal_info && !notes.blurred);
