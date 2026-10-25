import type { Timeline } from "@/lib/timeline/schema";
import type { OutputSpecId } from "./outputs";

// iOS 27 still images, rendered from the header and search timelines. Apple wants them without an alpha channel.

export type StillId = "header" | "search" | "universal";

export interface StillSpec {
  id: StillId;
  label: string;
  /** The output whose timeline the still is taken from. */
  source: Extract<OutputSpecId, "header" | "search">;
  width: number;
  height: number;
  safeArea: { w: number; h: number };
  fileName: string;
}

export const STILL_SPECS: Record<StillId, StillSpec> = {
  header: {
    id: "header",
    label: "Header still",
    source: "header",
    width: 3840,
    height: 1646,
    safeArea: { w: 1646 / 3840, h: 661 / 1646 },
    fileName: "appstore-header-still-21x9.png",
  },
  search: {
    id: "search",
    label: "Search still",
    source: "search",
    width: 3840,
    height: 2560,
    safeArea: { w: 2168 / 3840, h: 1030 / 2560 },
    fileName: "appstore-search-still-3x2.png",
  },
  // One image for either slot: it must survive the 21:9 crop (top and bottom) and the 3:2 crop (sides),
  // so its safe box is where both crops' safe boxes overlap.
  universal: {
    id: "universal",
    label: "Universal still",
    source: "header",
    width: 5244,
    height: 2950,
    safeArea: { w: 0.43, h: 0.31 },
    fileName: "appstore-universal-16x9.png",
  },
};

export const stillsFor = (spec: OutputSpecId): StillSpec[] => Object.values(STILL_SPECS).filter((s) => s.source === spec);

/** Remotion composition id for a still. */
export const stillCompositionId = (id: StillId) => `still-${id}`;

/** The moment to capture: the hook line fully on screen over the first shot, or 1 s in. */
export function stillSecond(timeline: Timeline): number {
  const hook = timeline.segments.find((s) => s.overlay && s.style !== "brand" && s.style !== "caption");
  if (!hook) return 1;
  return Math.round((hook.start + Math.min(1.6, hook.duration * 0.7)) * 100) / 100;
}
