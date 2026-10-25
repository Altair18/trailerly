import { z } from "zod";

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
