import { z } from "zod";
import { ClipNotes, showsPersonalData } from "@/lib/schemas/clips";

export const ANALYSE_SYSTEM = `You look at frames from a screen recording of a mobile app and describe each clip
for a video editor making an App Store preview and short ads.
For every clip give:
- label: 2 to 5 words saying what happens, e.g. "Asks a question", "Attaches a photo".
- feature: which of the app's features (from the list) the clip shows, or null.
- interest: 1 to 5. 1 = loading, blank, idle, settings or menus. 5 = the app's core value clearly on screen.
- personal_info: true if the frames show real personal data that is not the app's own demo content:
  people's names, email addresses, phone numbers, real message or chat titles, notifications, faces of private people.
- privacy_note: one short phrase saying what and where, or null.
- privacy_regions: when personal_info is true, boxes covering every area of the screen that shows the personal data
  in any of the clip's frames, as fractions of the frame: {"x": left, "y": top, "w": width, "h": height}, each 0 to 1.
  The content may scroll between frames, so make each box cover the whole area where it appears, with a margin.
  Cover a list as one box (e.g. a whole sidebar of chat titles), not one box per line. Up to 8 boxes. [] when none.
Return JSON: {"clips": [{"clip_id": "...", "label": "...", "feature": ... , "interest": n, "personal_info": bool, "privacy_note": ..., "privacy_regions": [...]}]}.`;

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
): Promise<Record<string, ClipNotes>> {
  const images = clips.flatMap((c) =>
    c.frames.map((data, i) => ({ data, label: i === 0 ? `Clip ${c.clipId}:` : undefined })),
  );
  const reply = await vision({
    system: ANALYSE_SYSTEM,
    prompt: JSON.stringify({ app_features: features, clip_ids: clips.map((c) => c.clipId) }),
    images,
  });
  return Object.fromEntries(reply.clips.map(({ clip_id, ...notes }) => [clip_id, notes]));
}

/** Clips ordered best first, with clips that still show personal data (not blurred) last. */
export function rankClips<T extends { id: string; notes?: ClipNotes }>(clips: T[]): T[] {
  const score = (c: T) => (showsPersonalData(c) ? -10 : 0) + (c.notes?.interest ?? 3);
  return clips
    .map((c, i) => ({ c, i }))
    .sort((a, b) => score(b.c) - score(a.c) || a.i - b.i)
    .map(({ c }) => c);
}
