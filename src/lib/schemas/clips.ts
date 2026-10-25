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
  /** Which shot of the shot list (1-based) this clip films, when there was a shot list. */
  shot: z.number().int().min(1).nullable().optional(),
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
  /** Stretches where nothing moves on screen (seconds from the clip's start); the editor skips them. */
  idle: z.array(z.object({ start: z.number(), duration: z.number() })).optional(),
});
export type Clip = z.infer<typeof Clip>;
export const Clips = z.array(Clip);

/** Still shows personal data: flagged and not (yet) blurred. */
export const isPrivate = (notes?: ClipNotes | null) => Boolean(notes?.personal_info && !notes.blurred);

/** Seconds of a clip where nothing happens. */
export const idleSeconds = (clip: Pick<Clip, "idle">) => (clip.idle ?? []).reduce((n, s) => n + s.duration, 0);

/** The longest stretch of a clip without dead time (the whole clip when there is none worth skipping). */
export function liveRange(clip: Pick<Clip, "duration" | "idle">): { offset: number; duration: number } {
  const idle = [...(clip.idle ?? [])].sort((a, b) => a.start - b.start);
  let best = { offset: 0, duration: 0 };
  let at = 0;
  for (const span of [...idle, { start: clip.duration, duration: 0 }]) {
    const len = span.start - at;
    if (len > best.duration) best = { offset: at, duration: len };
    at = Math.max(at, span.start + span.duration);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return best.duration >= 1 ? { offset: r(best.offset), duration: r(best.duration) } : { offset: 0, duration: clip.duration };
}
