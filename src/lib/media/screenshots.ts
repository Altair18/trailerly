import type { Listing } from "@/lib/schemas/listing";
import type { ClipNotes } from "@/lib/schemas/clips";
import { analyseClips, type Vision } from "./analyse";

export const MAX_SCREENSHOTS = 8;
/** Seconds each screenshot stays on screen when the fallback builds a timeline. */
export const SCREENSHOT_SECONDS = 3;

export interface Screenshot {
  id: string;
  url: string;
  notes?: ClipNotes;
}

/** The listing's screenshots with stable ids ("shot_1", ...). */
export function appScreenshots(listing: Pick<Listing, "screenshot_urls"> | null | undefined): Screenshot[] {
  return (listing?.screenshot_urls ?? []).slice(0, MAX_SCREENSHOTS).map((url, i) => ({ id: `shot_${i + 1}`, url }));
}

/** Label each screenshot (what it shows, which feature, interest) with the same check as clips. Best-effort. */
export async function labelScreenshots(
  shots: Screenshot[],
  features: string[],
  vision: Vision,
  fetchImage: (url: string) => Promise<Buffer> = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer()),
): Promise<Screenshot[]> {
  if (shots.length === 0) return shots;
  const frames = await Promise.all(shots.map(async (s) => ({ clipId: s.id, frames: [await fetchImage(s.url)] })));
  const notes = await analyseClips(frames, features, vision);
  return shots.map((s) => (notes[s.id] ? { ...s, notes: notes[s.id] } : s));
}
