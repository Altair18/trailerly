import type { SegmentType } from "@/lib/timeline/schema";

// Fixed output specs the planner, renderer and rules engine all read.
// Check Apple's numbers against App Store Connect before launch.

export type OutputSpecId =
  | "preview"
  | "header"
  | "search"
  | "header_b"
  | "header_c"
  | "search_b"
  | "search_c"
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
  /** Length the code-built fallback aims for (seconds). */
  targetSeconds: number;
  /**
   * Centred box (fractions of width and height) that every device crop keeps. Text and the focal point stay inside it.
   * Header and search are cropped differently on iPhone, iPad and Mac.
   */
  safeArea?: { w: number; h: number };
  /** A/B set: the output this is a variant of, and its letter (the base output is "A"). */
  variantOf?: "header" | "search";
  variant?: "B" | "C";
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
  allowedSegments: ["screen", "screenshot", "ai_scene", "text", "end_card"],
  maxAiSeconds: 8,
  minScreenShare: 0.4,
  loop: false,
  fileName: `social-ad-${n}-9x16.mp4`,
  targetSeconds: 20,
});

/** Same cut as the base output with a different hook, for Product Page Optimization tests. */
const variant = (base: OutputSpec, letter: "B" | "C"): OutputSpec => ({
  ...base,
  id: `${base.id}_${letter.toLowerCase()}` as OutputSpecId,
  label: `${base.label} ${letter}`,
  fileName: base.fileName.replace(".mp4", `-${letter.toLowerCase()}.mp4`),
  variantOf: base.id as "header" | "search",
  variant: letter,
});

const BASE_SPECS = {
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
    // Apple 2.3.4: screen capture only. Screenshots are allowed as a fallback but the rules warn.
    allowedSegments: ["screen", "screenshot", "text"],
    maxAiSeconds: 0,
    minScreenShare: 0,
    loop: false,
    fileName: "appstore-preview-886x1920.mp4",
    // Tight beat on store screenshots: about five 3 s shots and a 2.4 s end card, no shot shown twice. (Agency
    // previews built from long recordings run 25-30 s; ours read as dragging at 24 s with repeated stills.)
    targetSeconds: 19,
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
    allowedSegments: ["screen", "screenshot", "ai_scene", "text"],
    maxAiSeconds: 16,
    minScreenShare: 0,
    loop: true,
    fileName: "appstore-header-21x9.mp4",
    targetSeconds: 12,
    // Apple's template: about 1646 x 661 in the middle of 3840 x 1646.
    safeArea: { w: 1646 / 3840, h: 661 / 1646 },
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
    allowedSegments: ["screen", "screenshot", "ai_scene", "text"],
    maxAiSeconds: 8,
    minScreenShare: 0,
    loop: false,
    fileName: "appstore-search-3x2.mp4",
    targetSeconds: 10,
    // Apple's template: about 2168 x 1030 in the middle of 3840 x 2560.
    safeArea: { w: 2168 / 3840, h: 1030 / 2560 },
  },
  social_1: social(1),
  social_2: social(2),
  social_3: social(3),
  social_4: social(4),
  social_5: social(5),
} satisfies Partial<Record<OutputSpecId, OutputSpec>>;

export const OUTPUT_SPECS: Record<OutputSpecId, OutputSpec> = {
  ...BASE_SPECS,
  header_b: variant(BASE_SPECS.header as OutputSpec, "B"),
  header_c: variant(BASE_SPECS.header as OutputSpec, "C"),
  search_b: variant(BASE_SPECS.search as OutputSpec, "B"),
  search_c: variant(BASE_SPECS.search as OutputSpec, "C"),
};

/** Up to two extra hooks become variants B and C of the header and search videos. */
export const VARIANT_SPECS: OutputSpecId[] = ["header_b", "search_b", "header_c", "search_c"];

export const PACK_OUTPUTS = Object.keys(OUTPUT_SPECS) as OutputSpecId[];

/** Drafts render at a third of full size. */
export const DRAFT_SCALE = 1 / 3;

/** Outputs the drafts run produces so far; grows with each milestone (M5: social). */
export const DRAFT_SPECS: OutputSpecId[] = ["preview", "header", "search"];

/** The drafts to make for a pack: the base set, plus a B and C variant for each extra hook available. */
export function draftSpecsFor(variantHooks: string[]): OutputSpecId[] {
  const letters = (["B", "C"] as const).slice(0, variantHooks.length);
  return [...DRAFT_SPECS, ...VARIANT_SPECS.filter((id) => letters.includes(OUTPUT_SPECS[id].variant!))];
}

/** Landscape outputs (header, search) lay the portrait recording out on a stage instead of filling the frame. */
export const isLandscape = (spec: Pick<OutputSpec, "width" | "height">) => spec.width > spec.height;
