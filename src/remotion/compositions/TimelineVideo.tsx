import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type React from "react";
import { isOverlay } from "@/lib/timeline/enforce";
import { focusFor, type FocusPoint } from "@/lib/timeline/focus";
import type { Segment, Timeline } from "@/lib/timeline/schema";
import { useBrandFonts } from "../fonts";
import { LandscapeCard, LandscapeOverlay, LandscapeScene, type Media, type SafeArea, type SceneShot } from "./Landscape";
import { AppIcon, type Brand, DISPLAY, ENTER_FRAMES, INK, PUSH_IN, RevealWords, UI, useEntrance, useExit, Words, fitSize, YEL } from "./parts";

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
  /** clip_id -> where things change on screen over the clip; header and search lean in on it. */
  clipFocus?: Record<string, FocusPoint[]>;
}

/** Frames of the crossfade from the end of a looping video back to its first shot. */
const LOOP_FADE = 15;


export function TimelineVideo({ timeline, clipUrls, imageUrls = {}, watermark, loop, baseWidth, baseHeight, brand, safeArea, clipFocus }: TimelineVideoProps) {
  useBrandFonts();
  const { fps, width, durationInFrames } = useVideoConfig();
  const landscape = baseWidth > baseHeight;
  // Sizes in the portrait layout are fractions of the width; landscape uses a portrait-like width of the same height.
  const unit = landscape ? Math.round(Math.min(baseWidth, baseHeight * 0.54)) : baseWidth;
  const view = { clipUrls, imageUrls, brand, width: unit, landscape, baseWidth, baseHeight, safeArea };
  const scale = width / baseWidth;
  const base = timeline.segments.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  const overlays = timeline.segments.filter(isOverlay);

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: baseWidth, height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        {landscape ? (
          <>
            <LandscapeScene shots={sceneShots(base, clipUrls, imageUrls, fps, clipFocus)} width={baseWidth} height={baseHeight} safe={safeArea} loop={loop} accent={brand?.accent} />
            {base.map((seg, i) =>
              seg.type === "text" || seg.type === "end_card" ? (
                <Sequence key={`c${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
                  <LandscapeCard text={seg.text ?? brand?.name ?? ""} width={baseWidth} height={baseHeight} safe={safeArea} />
                </Sequence>
              ) : null,
            )}
          </>
        ) : (
          // Each shot stays up under the next one while it fades in, so a cut never shows the black backdrop.
          base.map((seg, i) => (
            <Sequence
              key={`b${i}`}
              from={Math.round(seg.start * fps)}
              durationInFrames={Math.max(1, Math.round(seg.duration * fps)) + (i < base.length - 1 ? ENTER_FRAMES : 0)}
            >
              <SegmentView segment={seg} index={i} {...view} />
            </Sequence>
          ))
        )}
        {!landscape && loop && base.length > 1 && durationInFrames > LOOP_FADE * 4 && (
          <Sequence from={durationInFrames - LOOP_FADE} durationInFrames={LOOP_FADE}>
            <LoopFade>
              <SegmentView segment={base[0]!} index={0} {...view} />
            </LoopFade>
          </Sequence>
        )}
        {overlays.map((seg, i) => (
          <Sequence key={`o${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            {landscape ? (
              <LandscapeOverlay style={seg.style} text={seg.text} brand={brand} width={baseWidth} height={baseHeight} safe={safeArea} />
            ) : seg.style === "brand" ? (
              <BrandOverlay brand={brand} text={seg.text} width={baseWidth} />
            ) : seg.style === "caption" ? (
              <CaptionOverlay text={seg.text ?? ""} width={baseWidth} />
            ) : (
              <HookOverlay text={seg.text ?? ""} width={baseWidth} />
            )}
          </Sequence>
        ))}
        {/* TODO(M5): voice-driven captions. */}
        {watermark && <Watermark width={landscape ? baseWidth * 0.45 : baseWidth} />}
      </div>
    </AbsoluteFill>
  );
}


/** The landscape stage's shots: every screen or screenshot segment that has media, in order. */
function sceneShots(
  base: Segment[],
  clipUrls: Record<string, string>,
  imageUrls: Record<string, string>,
  fps: number,
  clipFocus: Record<string, FocusPoint[]> = {},
): SceneShot[] {
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
    const focus = seg.type === "screen" && seg.clip_id ? focusFor(clipFocus[seg.clip_id], seg.clip_offset ?? 0, seg.duration) : null;
    if (media) shots.push({ media, from: Math.round(seg.start * fps), frames: Math.max(1, Math.round(seg.duration * fps)), focus });
  }
  return shots;
}

/** Fade the first shot in over the last frames so a looping video joins up. */
function LoopFade({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, durationInFrames], [0, 1]) }}>{children}</AbsoluteFill>;
}

function SegmentView({
  segment,
  clipUrls,
  imageUrls,
  brand,
  index,
  width,
  landscape,
  baseWidth,
  baseHeight,
  safeArea,
}: {
  segment: Segment;
  clipUrls: Record<string, string>;
  imageUrls: Record<string, string>;
  brand?: Brand;
  index: number;
  width: number;
  landscape: boolean;
  baseWidth: number;
  baseHeight: number;
  safeArea?: SafeArea;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = useEntrance(index);
  const src = segment.clip_id ? clipUrls[segment.clip_id] : undefined;
  const image = segment.image_id ? imageUrls[segment.image_id] : undefined;

  if (segment.type === "screen" && src) {
    const zoom = 1 + PUSH_IN * interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
    return (
      <AbsoluteFill style={{ opacity: enter.opacity, transform: `translateX(${enter.x}%)` }}>
        <OffthreadVideo
          src={src}
          muted
          trimBefore={Math.round((segment.clip_offset ?? 0) * fps)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }}
        />
      </AbsoluteFill>
    );
  }
  if (segment.type === "screenshot" && image) {
    return <ScreenshotView src={image} enter={enter} width={width} />;
  }
  if (segment.type === "end_card") return <EndCard brand={brand} text={segment.text} width={width} />;
  if (segment.type === "text") {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "10%", backgroundColor: YEL, opacity: enter.opacity }}>
        <Words text={segment.text ?? ""} style={{ ...DISPLAY, color: INK, fontSize: fitSize(segment.text ?? "", width, 0.16), textAlign: "center", justifyContent: "center" }} />
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ backgroundColor: "#18181F" }} />;
}

/**
 * A still App Store screenshot: a blurred, darkened copy fills the frame and the screenshot sits on top,
 * whole, in a rounded phone-like frame that rises in and pushes in slowly.
 */
function ScreenshotView({ src, enter, width }: { src: string; enter: { opacity: number; x: number }; width: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 14 });
  const zoom = 1 + PUSH_IN * interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const radius = Math.round(width * 0.045);
  return (
    <AbsoluteFill style={{ backgroundColor: INK, opacity: enter.opacity, overflow: "hidden" }}>
      <Img src={src} style={{ position: "absolute", inset: "-10%", width: "120%", height: "120%", objectFit: "cover", filter: "blur(40px) saturate(1.3)" }} />
      <AbsoluteFill style={{ backgroundColor: "rgba(10,10,14,0.55)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Img
          src={src}
          style={{
            maxHeight: "82%",
            maxWidth: "86%",
            objectFit: "contain",
            borderRadius: radius,
            border: `${Math.max(2, Math.round(width * 0.008))}px solid rgba(255,255,255,0.14)`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            transform: `translate(${enter.x}%, ${(1 - rise) * 6}%) scale(${zoom * (0.94 + 0.06 * rise)})`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}




/** The opening promise: a big yellow chip near the top. */
function HookOverlay({ text, width }: { text: string; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 140 } });
  const exit = useExit();
  const pad = Math.round(width * 0.06);
  return (
    <AbsoluteFill style={{ padding: pad, paddingTop: pad * 2.2, alignItems: "flex-start", opacity: exit }}>
      <div
        style={{
          backgroundColor: YEL,
          padding: `${pad * 0.4}px ${pad * 0.55}px`,
          borderRadius: pad * 0.45,
          maxWidth: "100%",
          transform: `scale(${0.85 + 0.15 * pop}) rotate(${(1 - pop) * -3}deg)`,
          transformOrigin: "top left",
          boxShadow: "0 30px 60px rgba(0,0,0,.45)",
        }}
      >
        <Words text={text} style={{ ...DISPLAY, color: INK, fontSize: fitSize(text, width, 0.115) }} />
      </div>
    </AbsoluteFill>
  );
}

/** What's on screen: a short line in a dark pill in the lower third. */
/**
 * A caption in the lower third: plain bold words rising in over a soft shadow, no box. A boxed caption
 * sliding up looked like an iOS notification banner landing on the screen.
 */
function CaptionOverlay({ text, width }: { text: string; width: number }) {
  const exit = useExit();
  const pad = Math.round(width * 0.07);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", opacity: exit }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 58%, rgba(6,6,10,.55) 82%, rgba(6,6,10,.7))" }} />
      <div style={{ padding: pad, paddingBottom: pad * 2.6, maxWidth: "100%" }}>
        <RevealWords
          text={text}
          style={{
            ...DISPLAY,
            color: "#FFFFFF",
            fontSize: fitSize(text, width, 0.09),
            justifyContent: "center",
            textAlign: "center",
            textShadow: "0 4px 24px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/** App icon and name over the last seconds of the video. */
function BrandOverlay({ brand, text, width }: { brand?: Brand; text?: string; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 15, stiffness: 140 } });
  const pad = Math.round(width * 0.06);
  const icon = Math.round(width * 0.17);
  return (
    <AbsoluteFill style={{ padding: pad, paddingBottom: pad * 2.6, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: pad * 0.45,
          background: "rgba(10,10,14,.9)",
          border: "2px solid rgba(255,255,255,.12)",
          padding: pad * 0.4,
          paddingRight: pad * 0.7,
          borderRadius: pad * 0.7,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 80}px) scale(${0.92 + 0.08 * rise})`,
          boxShadow: "0 30px 60px rgba(0,0,0,.5)",
          maxWidth: "100%",
        }}
      >
        <AppIcon brand={brand} size={icon} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...DISPLAY, color: "#F5F4F8", fontSize: fitSize(brand?.name ?? "", width, 0.075) }}>{brand?.name ?? ""}</div>
          <div style={{ ...UI, color: "#A9A8B6", fontSize: Math.round(width * 0.035), fontWeight: 600, marginTop: width * 0.01 }}>
            {text?.trim() || "On the App Store"}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Full-screen close: icon, name, a short line and a download button (social ads, header, search). */
function EndCard({ brand, text, width }: { brand?: Brand; text?: string; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const late = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 140 } });
  const icon = Math.round(width * 0.28);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: width * 0.05,
        padding: "10%",
        background: `radial-gradient(120% 80% at 50% 30%, #2A1240 0%, ${INK} 70%)`,
      }}
    >
      <div style={{ transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
        <AppIcon brand={brand} size={icon} />
      </div>
      <div style={{ ...DISPLAY, color: "#F5F4F8", fontSize: fitSize(brand?.name ?? "", width, 0.13), textAlign: "center", opacity: pop }}>{brand?.name}</div>
      {text?.trim() && <Words text={text} style={{ ...DISPLAY, color: YEL, fontSize: fitSize(text, width, 0.08), justifyContent: "center", textAlign: "center" }} />}
      <div
        style={{
          ...UI,
          fontWeight: 700,
          fontSize: Math.round(width * 0.045),
          color: INK,
          background: "#F5F4F8",
          padding: `${width * 0.03}px ${width * 0.06}px`,
          borderRadius: 999,
          opacity: late,
          transform: `translateY(${(1 - late) * 40}px)`,
        }}
      >
        Download on the App Store
      </div>
    </AbsoluteFill>
  );
}

function Watermark({ width }: { width: number }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ ...DISPLAY, color: "rgba(255,255,255,0.22)", fontSize: Math.round(width * 0.16), transform: "rotate(-30deg)", whiteSpace: "nowrap" }}>
        TRAILERLY DRAFT
      </div>
    </AbsoluteFill>
  );
}
