import type { SegmentType } from "@/lib/timeline/schema";

// Fixed output specs the planner, renderer and rules engine all read.
// Check Apple's numbers against App Store Connect before launch.

export type OutputSpecId =
  | "preview"
  | "header"
  | "search"
  | "social_1"
  | "social_2"
  | "social_3"
  | "social_4"
  | "social_5";

export type Placement = "appstore" | "social";

export interface OutputSpec {
  id: OutputSpecId;
  placement: Placement;
  label: string;
  width: number;
  height: number;
  fps: number;
  minSeconds: number;
  maxSeconds: number;
  sound: "optional" | "muted_default" | "always_muted" | "voice_music";
  allowedSegments: SegmentType[];
  /** Cap on total AI scene seconds. */
  maxAiSeconds: number;
  /** Minimum share of time on real screens (0 to 1). */
  minScreenShare: number;
  loop: boolean;
  fileName: string;
}

const social = (n: 1 | 2 | 3 | 4 | 5): OutputSpec => ({
  id: `social_${n}`,
  placement: "social",
  label: `Social ad ${n}`,
  width: 1080,
  height: 1920,
  fps: 30,
  minSeconds: 15,
  maxSeconds: 30,
  sound: "voice_music",
  allowedSegments: ["screen", "ai_scene", "text", "end_card"],
  maxAiSeconds: 8,
  minScreenShare: 0.4,
  loop: false,
  fileName: `social-ad-${n}-9x16.mp4`,
});

export const OUTPUT_SPECS: Record<OutputSpecId, OutputSpec> = {
  preview: {
    id: "preview",
    placement: "appstore",
    label: "App Store preview",
    width: 886,
    height: 1920,
    fps: 30,
    minSeconds: 15,
    maxSeconds: 30,
    sound: "optional",
    allowedSegments: ["screen", "text"], // Apple 2.3.4: screen capture only
    maxAiSeconds: 0,
    minScreenShare: 0,
    loop: false,
    fileName: "appstore-preview-886x1920.mp4",
  },
  header: {
    id: "header",
    placement: "appstore",
    label: "App Store header",
    width: 3840,
    height: 1646,
    fps: 30,
    minSeconds: 5,
    maxSeconds: 30,
    sound: "muted_default",
    allowedSegments: ["screen", "ai_scene", "text"],
    maxAiSeconds: 16,
    minScreenShare: 0,
    loop: true,
    fileName: "appstore-header-21x9.mp4",
  },
  search: {
    id: "search",
    placement: "appstore",
    label: "App Store search",
    width: 1920,
    height: 1280,
    fps: 30,
    minSeconds: 5,
    maxSeconds: 30,
    sound: "always_muted",
    allowedSegments: ["screen", "ai_scene", "text"],
    maxAiSeconds: 8,
    minScreenShare: 0,
    loop: false,
    fileName: "appstore-search-3x2.mp4",
  },
  social_1: social(1),
  social_2: social(2),
  social_3: social(3),
  social_4: social(4),
  social_5: social(5),
};

export const PACK_OUTPUTS = Object.keys(OUTPUT_SPECS) as OutputSpecId[];

/** Drafts render at a third of full size. */
export const DRAFT_SCALE = 1 / 3;
