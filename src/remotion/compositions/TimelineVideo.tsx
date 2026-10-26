import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type React from "react";
import { isOverlay } from "@/lib/timeline/enforce";
import type { Segment, Timeline } from "@/lib/timeline/schema";
import { useBrandFonts } from "../fonts";
import { DEFAULT_LOOK, LandscapeCard, LandscapeOverlay, LandscapeScene, type Look, type Media, type SafeArea, type SceneShot } from "./Landscape";
import { type Brand, DISPLAY, ENTER_FRAMES, INK, PINK } from "./parts";
import { PORTRAIT_SWAP, PortraitBrand, PortraitCard, PortraitEnd, PortraitLine, PortraitShot, PortraitStage } from "./Portrait";

export type { Brand } from "./parts";


export interface TimelineVideoProps extends Record<string, unknown> {
  timeline: Timeline;
  /** clip_id or scene id -> URL of the prepared clip. */
  clipUrls: Record<string, string>;
  watermark: boolean;
  /** Header only: crossfade last frame to first for a seamless loop. */
  loop: boolean;
  /** Full output size; the composition may render smaller (drafts) and scales this canvas down. */
  baseWidth: number;
  baseHeight: number;
  /** App name and icon for the brand overlay and end card. */
  brand?: Brand;
  /** image_id -> URL of an App Store screenshot, for screenshot segments. */
  imageUrls?: Record<string, string>;
  /** Header and search: the centred box every device crop keeps (fractions of the frame). */
  safeArea?: SafeArea;
  /** Header and search: which look to shoot the cut in (see Landscape's LOOKS). */
  look?: Look;
}

/** Frames of the crossfade from the end of a looping video back to its first shot. */
const LOOP_FADE = 15;


export function TimelineVideo({ timeline, clipUrls, imageUrls = {}, watermark, loop, baseWidth, baseHeight, brand, safeArea, look = DEFAULT_LOOK }: TimelineVideoProps) {
  useBrandFonts();
  const { fps, width, durationInFrames } = useVideoConfig();
  const landscape = baseWidth > baseHeight;
  // Sizes in the portrait layout are fractions of the width; landscape uses a portrait-like width of the same height.
  const unit = landscape ? Math.round(Math.min(baseWidth, baseHeight * 0.54)) : baseWidth;
  const view = { clipUrls, imageUrls, brand, width: unit, landscape, baseWidth, baseHeight, safeArea };
  const scale = width / baseWidth;
  const accent = brand?.accent ?? PINK;
  const base = timeline.segments.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  // Store screenshots carry their own headline, so in the portrait layout a caption over one would make two.
  const overlays = timeline.segments.filter(isOverlay).filter((o) => landscape || o.style !== "caption" || !overScreenshot(o, base));

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: baseWidth, height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        {landscape ? (
          <>
            <LandscapeScene shots={sceneShots(base, clipUrls, imageUrls, fps)} width={baseWidth} height={baseHeight} safe={safeArea} loop={loop} accent={brand?.accent} look={look} />
            {base.map((seg, i) =>
              seg.type === "text" || seg.type === "end_card" ? (
                <Sequence key={`c${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
                  <LandscapeCard text={seg.text ?? brand?.name ?? ""} width={baseWidth} height={baseHeight} safe={safeArea} />
                </Sequence>
              ) : null,
            )}
          </>
        ) : (
          <PortraitStage look={look} accent={accent}>
            {/* Each shot stays up under the next one while it fades in, so a cut never shows the backdrop. */}
            {base.map((seg, i) => (
              <Sequence
                key={`b${i}`}
                from={Math.round(seg.start * fps)}
                durationInFrames={Math.max(1, Math.round(seg.duration * fps)) + (i < base.length - 1 ? swapFrames(base[i + 1]!) : 0)}
              >
                <PortraitSegment segment={seg} index={i} {...view} look={look} accent={accent} centred={!underLine(seg, overlays)} />
              </Sequence>
            ))}
            {loop && base.length > 1 && durationInFrames > LOOP_FADE * 4 && (
              <Sequence from={durationInFrames - LOOP_FADE} durationInFrames={LOOP_FADE}>
                <LoopFade>
                  <PortraitSegment segment={base[0]!} index={0} {...view} look={look} accent={accent} />
                </LoopFade>
              </Sequence>
            )}
          </PortraitStage>
        )}
        {overlays.map((seg, i) => (
          <Sequence key={`o${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            {landscape ? (
              <LandscapeOverlay style={seg.style} text={seg.text} brand={brand} width={baseWidth} height={baseHeight} safe={safeArea} look={look} />
            ) : seg.style === "brand" ? (
              <PortraitBrand brand={brand} text={seg.text} look={look} width={baseWidth} height={baseHeight} />
            ) : (
              <PortraitLine text={seg.text ?? ""} look={look} accent={accent} width={baseWidth} height={baseHeight} />
            )}
          </Sequence>
        ))}
        {/* TODO(M5): voice-driven captions. */}
        {watermark && <Watermark width={landscape ? baseWidth * 0.45 : baseWidth} />}
      </div>
    </AbsoluteFill>
  );
}


/** Frames the next shot overlaps this one: a store screenshot is dealt in over a longer swap than a cut. */
function swapFrames(next: Segment): number {
  return next.type === "screenshot" ? PORTRAIT_SWAP : ENTER_FRAMES;
}

/** Whether any line of type shows while this shot is up. */
export function underLine(seg: Segment, overlays: Segment[]): boolean {
  const end = seg.start + seg.duration;
  return overlays.some((o) => o.start < end - 0.05 && o.start + o.duration > seg.start + 0.05);
}

/** Whether a caption sits mostly over a store screenshot. */
export function overScreenshot(o: Segment, base: Segment[]): boolean {
  const end = o.start + o.duration;
  const covered = base
    .filter((b) => b.type === "screenshot")
    .reduce((sum, b) => sum + Math.max(0, Math.min(end, b.start + b.duration) - Math.max(o.start, b.start)), 0);
  return covered > o.duration / 2;
}

/** The landscape stage's shots: every screen or screenshot segment that has media, in order. */
function sceneShots(base: Segment[], clipUrls: Record<string, string>, imageUrls: Record<string, string>, fps: number): SceneShot[] {
  const shots: SceneShot[] = [];
  for (const seg of base) {
    const src = seg.clip_id ? clipUrls[seg.clip_id] : undefined;
    const image = seg.image_id ? imageUrls[seg.image_id] : undefined;
    const media: Media | null =
      seg.type === "screen" && src
        ? { kind: "video", src, trimBefore: Math.round((seg.clip_offset ?? 0) * fps) }
        : seg.type === "screenshot" && image
          ? { kind: "image", src: image }
          : null;
    if (media) shots.push({ media, from: Math.round(seg.start * fps), frames: Math.max(1, Math.round(seg.duration * fps)) });
  }
  return shots;
}

/** Fade the first shot in over the last frames so a looping video joins up. */
function LoopFade({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, durationInFrames], [0, 1]) }}>{children}</AbsoluteFill>;
}

function PortraitSegment({
  segment,
  clipUrls,
  imageUrls,
  brand,
  index,
  baseWidth,
  baseHeight,
  look,
  accent,
  centred,
}: {
  segment: Segment;
  clipUrls: Record<string, string>;
  imageUrls: Record<string, string>;
  brand?: Brand;
  index: number;
  baseWidth: number;
  baseHeight: number;
  look: Look;
  accent: string;
  centred?: boolean;
}) {
  const { fps } = useVideoConfig();
  const src = segment.clip_id ? clipUrls[segment.clip_id] : undefined;
  const image = segment.image_id ? imageUrls[segment.image_id] : undefined;
  const size = { look, width: baseWidth, height: baseHeight };
  if (segment.type === "screen" && src) {
    return <PortraitShot media={{ kind: "video", src, trimBefore: Math.round((segment.clip_offset ?? 0) * fps) }} index={index} fade={ENTER_FRAMES} {...size} />;
  }
  if (segment.type === "screenshot" && image) {
    return <PortraitShot media={{ kind: "image", src: image }} index={index} fade={ENTER_FRAMES} frames={Math.round(segment.duration * fps)} centred={centred} {...size} />;
  }
  if (segment.type === "end_card") return <PortraitEnd brand={brand} text={segment.text} look={look} width={baseWidth} />;
  if (segment.type === "text") return <PortraitCard text={segment.text ?? ""} accent={accent} {...size} />;
  return null;
}

function Watermark({ width }: { width: number }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ ...DISPLAY, color: "rgba(255,255,255,0.14)", WebkitTextStroke: `${Math.max(1, Math.round(width * 0.002))}px rgba(0,0,0,0.12)`, fontSize: Math.round(width * 0.12), transform: "rotate(-30deg)", whiteSpace: "nowrap" }}>
        TRAILERLY DRAFT
      </div>
    </AbsoluteFill>
  );
}
