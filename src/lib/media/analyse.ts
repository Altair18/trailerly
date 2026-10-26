import { z } from "zod";
import { ClipNotes, isPrivate } from "@/lib/schemas/clips";

export const ANALYSE_SYSTEM = `You look at frames from a screen recording of a mobile app and describe each clip
for a video editor making an App Store preview and short ads.
For every clip give:
- label: 2 to 5 words saying what happens, e.g. "Asks a question", "Attaches a photo".
- feature: which of the app's features (from the list) the clip shows, or null.
- interest: 1 to 5. 1 = loading, blank, idle, settings or menus. 5 = the app's core value clearly on screen.
- personal_info: true if the frames show real personal data or real private content rather than demo content made
  for the video: people's names, email addresses, phone numbers, notifications, faces of private people, and the
  user's own real material, such as their chat titles, messages or AI replies about their own work, documents,
  project or file names. When unsure whether content is demo content, treat it as personal.
- privacy_note: one short phrase saying what and where, or null.
- private_regions: when personal_info is true, rectangles covering all of it in every frame of that clip, as fractions
  of the frame: {"x": left, "y": top, "w": width, "h": height}, each 0 to 1. Be generous (cover whole lists or
  panels, not single words) and merge overlapping areas. Empty list when personal_info is false.
- shot: when a shot list is given, the number of the shot this clip films (1-based), or null if none fits.
- headline_band: only when the image is an App Store marketing screenshot with its own headline or caption text
  printed outside the app's UI (usually big words above or below a phone or the app screen): {"edge": "top" or
  "bottom", "h": share of the image height, 0 to 0.6, from that edge down to just past the last line of that text}.
  null for a plain screen with no marketing text.
Return JSON: {"clips": [{"clip_id": "...", "label": "...", "feature": ... , "interest": n, "personal_info": bool,
"privacy_note": ..., "private_regions": [...], "shot": n or null, "headline_band": ... or null}]}.`;

export const ClipNotesReply = z.object({
  clips: z.array(ClipNotes.extend({ clip_id: z.string() })),
});

export interface ClipFrames {
  clipId: string;
  frames: Buffer[];
}

export type Vision = (opts: {
  system: string;
  prompt: string;
  images: { data: Buffer; label?: string }[];
}) => Promise<z.infer<typeof ClipNotesReply>>;

/** Ask the model what each clip shows and whether it leaks personal data. */
export async function analyseClips(
  clips: ClipFrames[],
  features: string[],
  vision: Vision,
  shots?: string[],
): Promise<Record<string, ClipNotes>> {
  const images = clips.flatMap((c) =>
    c.frames.map((data, i) => ({ data, label: i === 0 ? `Clip ${c.clipId}:` : undefined })),
  );
  const reply = await vision({
    system: ANALYSE_SYSTEM,
    prompt: JSON.stringify({
      app_features: features,
      clip_ids: clips.map((c) => c.clipId),
      shot_list: shots?.length ? shots.map((action, i) => ({ shot: i + 1, action })) : undefined,
    }),
    images,
  });
  return Object.fromEntries(reply.clips.map(({ clip_id, ...notes }) => [clip_id, notes]));
}

/** Clips ordered best first, with clips that still show personal data last. */
export function rankClips<T extends { id: string; notes?: ClipNotes }>(clips: T[]): T[] {
  const score = (c: T) => (isPrivate(c.notes) ? -10 : 0) + (c.notes?.interest ?? 3);
  return clips
    .map((c, i) => ({ c, i }))
    .sort((a, b) => score(b.c) - score(a.c) || a.i - b.i)
    .map(({ c }) => c);
}
