import type { ClipNotes } from "@/lib/schemas/clips";
import type { Timeline } from "./schema";

// Agency videos never set their own line over a store screenshot that already carries a headline ("Never forget to
// water again" over "NEVER FORGET" is two headlines in one frame). The labeller marks where a screenshot's own
// headline sits; every screenshot segment then crops that strip off, so only the app's UI is shown.

/** Most of a screenshot that may be cropped away: past this the label is probably wrong, so leave the image whole. */
const MAX_CROP = 0.45;

export function headlineCrop(notes?: Pick<ClipNotes, "headline_band"> | null): { top?: number; bottom?: number } | undefined {
  const band = notes?.headline_band;
  if (!band || !(band.h > 0.03) || band.h > MAX_CROP) return undefined;
  const h = Math.round(band.h * 1000) / 1000;
  return band.edge === "top" ? { top: h } : { bottom: h };
}

/** Crop every screenshot segment's own headline off, from the screenshots' labels. */
export function cropScreenshotHeadlines(timeline: Timeline, screenshots: { id: string; notes?: Pick<ClipNotes, "headline_band"> }[]): Timeline {
  const crops = new Map(screenshots.map((s) => [s.id, headlineCrop(s.notes)]));
  return {
    ...timeline,
    segments: timeline.segments.map((s) => {
      const crop = s.type === "screenshot" && s.image_id ? crops.get(s.image_id) : undefined;
      return crop ? { ...s, crop } : s;
    }),
  };
}

/**
 * Text drawn over a screenshot whose own headline is still in the frame: two headlines at once, which no agency
 * video does. Empty when every such screenshot is cropped (or none has a headline).
 */
export function doubleHeadlines(timeline: Timeline, screenshots: { id: string; notes?: Pick<ClipNotes, "headline_band"> }[]): string[] {
  const banded = new Set(screenshots.filter((s) => s.notes?.headline_band).map((s) => s.id));
  const overlays = timeline.segments.filter((s) => s.type === "text" && s.overlay && s.text?.trim());
  return timeline.segments
    .filter((s) => s.type === "screenshot" && s.image_id && banded.has(s.image_id) && !s.crop)
    .filter((s) => overlays.some((o) => o.start < s.start + s.duration - 0.05 && o.start + o.duration > s.start + 0.05))
    .map((s) => `Text sits over ${s.image_id} at ${s.start}s, which has its own headline: crop it or drop the text.`);
}
