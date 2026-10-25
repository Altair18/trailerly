import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties } from "react";
import { isOverlay } from "@/lib/timeline/enforce";
import type { Segment, Timeline } from "@/lib/timeline/schema";
import { useBrandFonts } from "../fonts";

export interface Brand {
  name: string;
  iconUrl: string | null;
}

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
}

const INK = "#0A0A0E";
const YEL = "#FFE135";
const PINK = "#FF2E88";
const DISPLAY = { fontFamily: "Archivo, sans-serif", fontStretch: "72%", fontWeight: 900, lineHeight: 0.95 } as const;
const UI = { fontFamily: "Geist, system-ui, sans-serif" } as const;

/** Frames for a segment's entrance (slide + fade) and the slow push-in across a screen segment. */
const ENTER_FRAMES = 8;
const PUSH_IN = 0.06;

export function TimelineVideo({ timeline, clipUrls, imageUrls = {}, watermark, baseWidth, baseHeight, brand }: TimelineVideoProps) {
  useBrandFonts();
  const { fps, width } = useVideoConfig();
  const scale = width / baseWidth;
  const base = timeline.segments.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  const overlays = timeline.segments.filter(isOverlay);

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: baseWidth, height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        {base.map((seg, i) => (
          <Sequence key={`b${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            <SegmentView segment={seg} clipUrls={clipUrls} imageUrls={imageUrls} brand={brand} index={i} width={baseWidth} />
          </Sequence>
        ))}
        {overlays.map((seg, i) => (
          <Sequence key={`o${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            {seg.style === "brand" ? (
              <BrandOverlay brand={brand} text={seg.text} width={baseWidth} />
            ) : seg.style === "caption" ? (
              <CaptionOverlay text={seg.text ?? ""} width={baseWidth} />
            ) : (
              <HookOverlay text={seg.text ?? ""} width={baseWidth} />
            )}
          </Sequence>
        ))}
        {/* TODO(M3): device frame for header/search, 0.5 s loop crossfade. TODO(M5): voice-driven captions. */}
        {watermark && <Watermark width={baseWidth} />}
      </div>
    </AbsoluteFill>
  );
}

/** Slide in from the right and fade up over the first few frames; the first segment just appears. */
function useEntrance(index: number) {
  const frame = useCurrentFrame();
  if (index === 0) return { opacity: 1, x: 0 };
  const t = interpolate(frame, [0, ENTER_FRAMES], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return { opacity: t, x: (1 - t) * 8 };
}

function SegmentView({
  segment,
  clipUrls,
  imageUrls,
  brand,
  index,
  width,
}: {
  segment: Segment;
  clipUrls: Record<string, string>;
  imageUrls: Record<string, string>;
  brand?: Brand;
  index: number;
  width: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = useEntrance(index);
  const src = segment.clip_id ? clipUrls[segment.clip_id] : undefined;

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
  const image = segment.image_id ? imageUrls[segment.image_id] : undefined;
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

/** Font size that keeps a line inside the frame: shrinks as the text gets longer. */
function fitSize(text: string, width: number, base: number) {
  const chars = Math.max(10, text.length);
  return Math.round(width * Math.min(base, (base * 22) / chars));
}

/** Words pop in one after another with a spring. */
function Words({ text, style }: { text: string; style: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.25em", ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - i * 2, fps, config: { damping: 14, stiffness: 160 } });
        return (
          <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 0.35}em) scale(${0.9 + 0.1 * s})` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** Fade out over the last few frames of an overlay. */
function useExit() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
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
function CaptionOverlay({ text, width }: { text: string; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const exit = useExit();
  const pad = Math.round(width * 0.06);
  return (
    <AbsoluteFill style={{ padding: pad, paddingBottom: pad * 3, justifyContent: "flex-end", alignItems: "center", opacity: exit }}>
      <div
        style={{
          background: "rgba(10,10,14,.86)",
          border: `${Math.max(2, Math.round(width * 0.004))}px solid rgba(255,255,255,.12)`,
          padding: `${pad * 0.35}px ${pad * 0.55}px`,
          borderRadius: pad * 0.5,
          maxWidth: "100%",
          opacity: rise,
          transform: `translateY(${(1 - rise) * 60}px)`,
          boxShadow: "0 24px 50px rgba(0,0,0,.5)",
        }}
      >
        <Words text={text} style={{ ...DISPLAY, color: "#F5F4F8", fontSize: fitSize(text, width, 0.085), justifyContent: "center", textAlign: "center" }} />
      </div>
    </AbsoluteFill>
  );
}

function AppIcon({ brand, size }: { brand?: Brand; size: number }) {
  const radius = Math.round(size * 0.225);
  if (brand?.iconUrl) return <Img src={brand.iconUrl} style={{ width: size, height: size, borderRadius: radius, boxShadow: "0 20px 50px rgba(0,0,0,.45)" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${PINK}, #9D7BFF)`, display: "flex", alignItems: "center", justifyContent: "center", ...DISPLAY, color: "#fff", fontSize: size * 0.55 }}>
      {(brand?.name ?? "A").slice(0, 1)}
    </div>
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
