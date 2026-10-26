import { Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties } from "react";

// Shared look and motion for the portrait and landscape layouts.

export interface Brand {
  name: string;
  iconUrl: string | null;
  /** The app's colour (from its icon), for glows and the hook's key word. */
  accent?: string;
}

export const INK = "#0A0A0E";
export const YEL = "#FFE135";
export const PINK = "#FF2E88";
export const DISPLAY = { fontFamily: "Archivo, sans-serif", fontStretch: "72%", fontWeight: 900, lineHeight: 0.95 } as const;
export const UI = { fontFamily: "Geist, system-ui, sans-serif" } as const;

/** Frames for a segment's entrance (slide + fade) and the slow push-in across a screen segment. */
export const ENTER_FRAMES = 8;
export const PUSH_IN = 0.06;

/** Slide in from the right and fade up over the first few frames; the first segment just appears. */
export function useEntrance(index: number) {
  const frame = useCurrentFrame();
  if (index === 0) return { opacity: 1, x: 0 };
  const t = interpolate(frame, [0, ENTER_FRAMES], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return { opacity: t, x: (1 - t) * 8 };
}

/** Font size that keeps a line inside the frame: shrinks as the text gets longer. */
export function fitSize(text: string, width: number, base: number) {
  const chars = Math.max(10, text.length);
  return Math.round(width * Math.min(base, (base * 22) / chars));
}

/** Words pop in one after another with a spring. */
export function Words({ text, style }: { text: string; style: CSSProperties }) {
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
export function useExit() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
}

export function AppIcon({ brand, size }: { brand?: Brand; size: number }) {
  const radius = Math.round(size * 0.225);
  if (brand?.iconUrl) return <Img src={brand.iconUrl} style={{ width: size, height: size, borderRadius: radius, boxShadow: "0 20px 50px rgba(0,0,0,.45)" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${PINK}, #9D7BFF)`, display: "flex", alignItems: "center", justifyContent: "center", ...DISPLAY, color: "#fff", fontSize: size * 0.55 }}>
      {(brand?.name ?? "A").slice(0, 1)}
    </div>
  );
}

/** Words rise into place one after another from behind a mask, the way title designers set lines. */
export function RevealWords({ text, style, highlight = -1, accent, delay = 0 }: { text: string; style: CSSProperties; highlight?: number; accent?: string; delay?: number }) {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.24em", ...style }}>
      {words.map((w, i) => {
        const t = interpolate(frame - delay - i * 3, [0, 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - t) * 105}%)`, color: i === highlight && accent ? accent : undefined }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}
