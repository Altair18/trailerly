import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { Grain, keyWord, type Look, luminance, WARM, withAlpha } from "./Landscape";
import { AppIcon, type Brand, DISPLAY, INK, RevealWords, SERIF, UI, YEL } from "./parts";

// The App Store preview (9:16) in the same three looks as the header and search videos. Modelled on top apps'
// App Previews: the app's screen is the hero and stays put between shots (only what's on it changes), one short
// line of type sits above it, and nothing else moves. No blurred copy of the screen behind it, no zoom into the UI.

export interface PBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortraitLayout {
  /** Where the app screen sits. */
  media: PBox;
  /** Where the line of type sits. */
  text: PBox;
  /** Corner radius of the screen (0 when it fills the frame). */
  radius: number;
  /** The screen fills the whole frame and the type sits on it. */
  bleed: boolean;
}

export function portraitLayout(look: Look, width: number, height: number): PortraitLayout {
  if (look === "bold") {
    // A solid band of the app's colour on top, the screen edge to edge under it: the classic store layout.
    const band = 0.22;
    return {
      media: { x: 0, y: height * band, w: width, h: height * (1 - band) },
      text: { x: width * 0.07, y: height * 0.035, w: width * 0.86, h: height * (band - 0.05) },
      radius: 0,
      bleed: true,
    };
  }
  const side = look === "cinematic" ? 0.09 : 0.07;
  const top = 0.25;
  return {
    media: { x: width * side, y: height * top, w: width * (1 - side * 2), h: height * (0.965 - top) },
    text: { x: width * 0.07, y: height * 0.065, w: width * 0.86, h: height * (top - 0.085) },
    radius: Math.round(width * 0.065),
    bleed: false,
  };
}

interface PortraitStyle {
  /** Backdrop of the whole frame. */
  background: string;
  ink: string;
  muted: string;
  type: CSSProperties;
  /** Font size as a share of the width, before long lines shrink it. */
  size: number;
  /** How the key word of a line stands out. */
  key: (accent: string) => { accent?: string; style?: CSSProperties };
  align: "center" | "left";
  grain: number;
  vignette?: string;
  /** Scale of the whole stage at progress t (0..1) through the video. */
  push: (t: number) => number;
}

export function portraitStyle(look: Look, accent: string): PortraitStyle {
  if (look === "cinematic") {
    return {
      background: [
        `radial-gradient(90% 45% at 15% 8%, ${withAlpha(WARM, 0.22)}, transparent 70%)`,
        `radial-gradient(80% 50% at 60% 60%, ${withAlpha(accent, 0.08)}, transparent 70%)`,
        "#0D0A08",
      ].join(", "),
      ink: "#F4EEE6",
      muted: "#BDB2A6",
      type: { ...SERIF, letterSpacing: "-0.01em" },
      size: 0.118,
      key: () => ({ style: { fontStyle: "italic" } }),
      align: "center",
      grain: 0.1,
      vignette: "radial-gradient(110% 80% at 50% 45%, transparent 55%, rgba(8,5,3,.75) 100%)",
      push: (t) => 1 + 0.03 * Easing.inOut(Easing.quad)(t),
    };
  }
  if (look === "bold") {
    const light = luminance(accent) > 0.4;
    return {
      background: accent,
      ink: light ? INK : "#FFFFFF",
      muted: light ? "rgba(10,10,14,.7)" : "rgba(255,255,255,.8)",
      type: { ...DISPLAY, textTransform: "uppercase", letterSpacing: "0.005em" },
      size: 0.105,
      key: () => ({ style: { textDecoration: "underline", textDecorationThickness: "0.08em", textUnderlineOffset: "0.12em" } }),
      align: "center",
      grain: 0,
      push: () => 1,
    };
  }
  return {
    background: [
      `radial-gradient(110% 40% at 50% 0%, ${withAlpha(accent, 0.28)}, transparent 75%)`,
      `linear-gradient(180deg, #14131A, ${INK} 60%)`,
    ].join(", "),
    ink: "#F7F6FA",
    muted: "#B4B3C0",
    type: { ...DISPLAY, letterSpacing: "-0.005em" },
    size: 0.1,
    key: (a) => ({ accent: luminance(a) > 0.12 ? a : undefined }),
    align: "center",
    grain: 0,
    push: () => 1,
  };
}

/** Size that keeps a line on at most three rows of the text box. */
function lineSize(text: string, width: number, share: number) {
  const chars = Math.max(12, text.length);
  return Math.round(width * Math.min(share, (share * 26) / chars));
}

/**
 * Width that splits a line into even rows, so a caption never ends on one word alone ("...to water / again").
 * Glyphs average about half the font size across (less in the serif).
 */
export function balancedWidth(text: string, size: number, max: number, glyph = 0.5): number {
  const one = text.length * size * glyph;
  const rows = Math.ceil(one / max);
  return rows <= 1 ? max : Math.min(max, (one / rows) * 1.18);
}

/** The frame behind everything: the look's backdrop, and in the cinematic look a slow push of the whole stage. */
export function PortraitStage({ look, accent, children }: { look: Look; accent: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const S = portraitStyle(look, accent);
  const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  return (
    <AbsoluteFill style={{ background: S.background }}>
      {/* The vignette darkens the backdrop's edges only: over the app's screen it reads as a smudge. */}
      {S.vignette && <AbsoluteFill style={{ background: S.vignette }} />}
      <AbsoluteFill style={{ transform: `scale(${S.push(t)})`, transformOrigin: "50% 60%" }}>{children}</AbsoluteFill>
      {S.grain > 0 && <Grain opacity={S.grain} />}
    </AbsoluteFill>
  );
}

export type PortraitMedia = { kind: "video"; src: string; trimBefore: number } | { kind: "image"; src: string };

/**
 * One shot of the app's screen in its box. The box is the same in every shot, so a cut reads as the screen
 * changing, not a new picture arriving: the shot only fades in over the one before.
 */
export function PortraitShot({ media, look, width, height, index, fade }: { media: PortraitMedia; look: Look; width: number; height: number; index: number; fade: number }) {
  const frame = useCurrentFrame();
  const L = portraitLayout(look, width, height);
  const opacity = index === 0 ? 1 : interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const m = L.media;
  const fill: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" };
  return (
    <AbsoluteFill>
      {!L.bleed && (
        // The screen's shadow and edge stay up through every cut.
        <div
          style={{
            position: "absolute",
            left: m.x,
            top: m.y,
            width: m.w,
            height: m.h,
            borderRadius: L.radius,
            boxShadow: `0 ${width * 0.04}px ${width * 0.1}px rgba(0,0,0,.5), 0 0 0 ${Math.max(2, Math.round(width * 0.004))}px rgba(255,255,255,.1)`,
          }}
        />
      )}
      <div style={{ position: "absolute", left: m.x, top: m.y, width: m.w, height: m.h, borderRadius: L.radius, overflow: "hidden", opacity, background: "#000" }}>
        {media.kind === "video" ? <OffthreadVideo src={media.src} muted trimBefore={media.trimBefore} style={fill} /> : <Img src={media.src} style={fill} />}
      </div>
    </AbsoluteFill>
  );
}

/** A full-frame card with one line on it (text segments). */
export function PortraitCard({ text, look, accent, width, height }: { text: string; look: Look; accent: string; width: number; height: number }) {
  const S = portraitStyle(look, accent);
  const k = S.key(accent);
  return (
    <AbsoluteFill style={{ background: S.background, alignItems: "center", justifyContent: "center", padding: width * 0.1 }}>
      <RevealWords
        text={text}
        highlight={keyWord(text)}
        accent={k.accent}
        highlightStyle={k.style}
        style={{ ...S.type, color: S.ink, fontSize: lineSize(text, width, S.size * 1.35), textAlign: "center", justifyContent: "center" }}
      />
    </AbsoluteFill>
  );
}

/** The hook or a caption: one line in the text box, rising in word by word and lifting away at the end. */
export function PortraitLine({ text, look, accent, width, height }: { text: string; look: Look; accent: string; width: number; height: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const S = portraitStyle(look, accent);
  const L = portraitLayout(look, width, height);
  const k = S.key(accent);
  const leave = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const t = L.text;
  return (
    <div
      style={{
        position: "absolute",
        left: t.x,
        top: t.y,
        width: t.w,
        height: t.h,
        display: "flex",
        alignItems: "center",
        justifyContent: S.align === "center" ? "center" : "flex-start",
        opacity: 1 - leave,
        transform: `translateY(${-leave * width * 0.03}px)`,
      }}
    >
      <RevealWords
        text={text}
        highlight={keyWord(text)}
        accent={k.accent}
        highlightStyle={k.style}
        style={{
          ...S.type,
          color: S.ink,
          fontSize: lineSize(text, width, S.size),
          textAlign: S.align,
          justifyContent: S.align === "center" ? "center" : "flex-start",
          maxWidth: balancedWidth(text, lineSize(text, width, S.size), t.w, look === "cinematic" ? 0.4 : 0.5),
        }}
      />
    </div>
  );
}

/** The app's icon and name in the text box over the last seconds. */
export function PortraitBrand({ brand, text, look, width, height }: { brand?: Brand; text?: string; look: Look; width: number; height: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = portraitStyle(look, brand?.accent ?? "#FF2E88");
  const L = portraitLayout(look, width, height);
  const rise = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const icon = Math.round(width * 0.15);
  const t = L.text;
  return (
    <div
      style={{
        position: "absolute",
        left: t.x,
        top: t.y,
        width: t.w,
        height: t.h,
        display: "flex",
        alignItems: "center",
        justifyContent: S.align === "center" ? "center" : "flex-start",
        gap: width * 0.04,
        opacity: rise,
        transform: `translateY(${(1 - rise) * width * 0.03}px)`,
      }}
    >
      <AppIcon brand={brand} size={icon} />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...S.type, textTransform: "none", color: S.ink, fontSize: lineSize(brand?.name ?? "", width, S.size * 0.8), lineHeight: 1 }}>{brand?.name ?? ""}</div>
        <div style={{ ...UI, color: S.muted, fontSize: Math.round(width * 0.036), fontWeight: 500, marginTop: width * 0.012 }}>{text?.trim() || "On the App Store"}</div>
      </div>
    </div>
  );
}

/** Close: icon, name and a short line, set in the look's type on its backdrop. */
export function PortraitEnd({ brand, text, look, width }: { brand?: Brand; text?: string; look: Look; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = portraitStyle(look, brand?.accent ?? "#FF2E88");
  const pop = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const late = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 120 } });
  const icon = Math.round(width * 0.26);
  const k = S.key(brand?.accent ?? "#FF2E88");
  return (
    <AbsoluteFill style={{ background: S.background, alignItems: "center", justifyContent: "center", gap: width * 0.05, padding: "10%" }}>
      <div style={{ opacity: pop, transform: `translateY(${(1 - pop) * width * 0.04}px) scale(${0.94 + 0.06 * pop})` }}>
        <AppIcon brand={brand} size={icon} />
      </div>
      <div style={{ ...S.type, textTransform: "none", color: S.ink, fontSize: lineSize(brand?.name ?? "", width, S.size * 1.1), textAlign: "center", opacity: pop }}>{brand?.name}</div>
      {text?.trim() && (
        <RevealWords
          text={text}
          delay={6}
          highlight={keyWord(text)}
          accent={k.accent}
          highlightStyle={k.style}
          style={{ ...S.type, color: S.muted, fontSize: lineSize(text, width, S.size * 0.62), justifyContent: "center", textAlign: "center" }}
        />
      )}
      <div style={{ ...UI, color: S.muted, fontSize: Math.round(width * 0.036), fontWeight: 500, letterSpacing: "0.02em", opacity: late }}>Download on the App Store</div>
    </AbsoluteFill>
  );
}
