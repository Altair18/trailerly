import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { type Crop, cropStyle, Grain, keyWord, type Look, luminance, WARM, withAlpha } from "./Landscape";
import { AppIcon, type Brand, DISPLAY, INK, RevealWords, SERIF, UI, YEL } from "./parts";
import { BrandBackdrop, brandStyleOf, brandType, Headline, headlineSize, splitHeadline } from "./Brand";

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
export function PortraitStage({ look, accent, children, brand, width, height }: { look: Look; accent: string; children: ReactNode; brand?: Brand; width?: number; height?: number }) {
  const frame = useCurrentFrame();
  if (look === "brand" && width && height) {
    return (
      <AbsoluteFill>
        <BrandBackdrop S={brandStyleOf(brand)} width={width} height={height} light={{ x: width * 0.5, y: height * 0.6 }} />
        {children}
      </AbsoluteFill>
    );
  }
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

export type PortraitMedia = { kind: "video"; src: string; trimBefore: number } | { kind: "image"; src: string; crop?: Crop };

/**
 * One shot of the app's screen in its box. The box is the same in every shot, so a cut reads as the screen
 * changing, not a new picture arriving: the shot only fades in over the one before.
 */
/** Frames two store screenshots overlap while one is dealt over the other. */
export const PORTRAIT_SWAP = 14;

/** How far a store screenshot pushes in over its shot (brand look). */
export const STILL_PUSH = 1.06;

/**
 * One shot of the app's screen in its box.
 *
 * A recording keeps one fixed box, so a cut reads as the screen changing: the shot only fades in over the one
 * before. A store screenshot is a card: it is dealt up from below over the last one, which settles back and dims
 * under it, and a soft light glances off it as it lands. With no line of type over it, the card sits in the middle
 * of the frame instead of leaving an empty band on top.
 */
export function PortraitShot({
  media,
  look,
  width,
  height,
  index,
  fade,
  frames,
  centred = false,
  focus,
}: {
  media: PortraitMedia;
  look: Look;
  width: number;
  height: number;
  index: number;
  fade: number;
  /** The shot's own length, before the next one overlaps it. */
  frames?: number;
  centred?: boolean;
  /** Recording shots: push in slowly on where the action is (brand look). */
  focus?: { x: number; y: number; zoom: number };
}) {
  const frame = useCurrentFrame();
  const L = portraitLayout(look, width, height);
  const push =
    focus && look === "brand" && media.kind === "video" && frames
      ? interpolate(frame, [0, frames], [1, focus.zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
      : 1;
  const pushStyle: CSSProperties = push > 1 ? { transform: `scale(${push})`, transformOrigin: `${focus!.x * 100}% ${focus!.y * 100}%` } : {};
  // A store screenshot never sits dead still in the brand look: a slow push, as agency previews do with stills.
  const drift =
    look === "brand" && media.kind === "image" && frames
      ? interpolate(frame, [0, frames + PORTRAIT_SWAP], [1, STILL_PUSH], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
      : 1;
  const card = media.kind === "image" && !L.bleed;
  const m = card && centred ? { ...L.media, y: (height - L.media.h) / 2 } : L.media;
  const fill: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" };
  // Edge to edge, a store screenshot (with its own headline at the bottom) would lose its foot: show it whole.
  const still: CSSProperties = L.bleed ? { ...fill, objectFit: "contain", objectPosition: "50% 0%" } : fill;

  let opacity = index === 0 ? 1 : interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  let transform = "none";
  let dim = 0;
  let sheen = -1;
  if (card) {
    opacity = 1;
    const rise = index === 0 ? 1 : interpolate(frame, [0, PORTRAIT_SWAP], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const leave = frames ? interpolate(frame, [frames, frames + PORTRAIT_SWAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }) : 0;
    const y = (1 - rise) * (height - m.y + height * 0.04) - leave * height * 0.025;
    transform = `translateY(${y}px) scale(${1 - 0.07 * leave}) rotate(${(1 - rise) * 2.5}deg)`;
    dim = 0.55 * leave;
    // The card underneath is gone by the time the new one lands, so its edge never peeks out below.
    opacity = 1 - interpolate(leave, [0.1, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    sheen = index === 0 ? -1 : interpolate(frame, [PORTRAIT_SWAP - 4, PORTRAIT_SWAP + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  }
  const box: CSSProperties = { position: "absolute", left: m.x, top: m.y, width: m.w, height: m.h, borderRadius: L.radius };
  return (
    <AbsoluteFill style={{ transform, transformOrigin: `50% ${m.y + m.h / 2}px`, opacity: card ? opacity : 1 }}>
      {!L.bleed && (
        // The screen's shadow and edge stay up through every cut.
        <div style={{ ...box, boxShadow: `0 ${width * 0.04}px ${width * 0.1}px rgba(0,0,0,.5), 0 0 0 ${Math.max(2, Math.round(width * 0.004))}px rgba(255,255,255,.1)` }} />
      )}
      <div style={{ ...box, overflow: "hidden", opacity: card ? 1 : opacity, background: L.bleed && media.kind === "image" ? "transparent" : "#000" }}>
        {media.kind === "video" ? (
          <OffthreadVideo src={media.src} muted trimBefore={media.trimBefore} style={{ ...fill, ...pushStyle }} />
        ) : (
          <div style={{ width: "100%", height: "100%", transform: drift > 1 ? `scale(${drift})` : undefined, transformOrigin: "50% 35%" }}>
            <Img src={media.src} style={{ ...still, ...cropStyle(media.crop) }} />
          </div>
        )}
        {sheen > 0 && sheen < 1 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(115deg, transparent ${sheen * 160 - 40}%, rgba(255,255,255,.22) ${sheen * 160 - 25}%, transparent ${sheen * 160 - 10}%)`,
            }}
          />
        )}
        {dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />}
      </div>
    </AbsoluteFill>
  );
}

/** A full-frame card with one line on it (text segments). */
export function PortraitCard({ text, look, accent, brand, width, height }: { text: string; look: Look; accent: string; brand?: Brand; width: number; height: number }) {
  if (look === "brand") {
    const B = brandStyleOf(brand);
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: width * 0.1 }}>
        <BrandBackdrop S={B} width={width} height={height} light={{ x: width / 2, y: height / 2 }} />
        <Headline text={text} S={B} size={headlineSize(splitHeadline(text), B.font, width * 0.8, width * 0.13)} align="center" />
      </AbsoluteFill>
    );
  }
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
export function PortraitLine({ text, look, accent, brand, width, height, first = false }: { text: string; look: Look; accent: string; brand?: Brand; width: number; height: number; first?: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (look === "brand") {
    // Agency previews set the line in two tones, already there on the first frame and crossfading between beats.
    const B = brandStyleOf(brand);
    const T = portraitLayout(look, width, height).text;
    const fade = Math.min(
      first ? 1 : interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
      interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" }),
    );
    return (
      <div style={{ position: "absolute", left: T.x, top: T.y, width: T.w, height: T.h, display: "flex", alignItems: "center", justifyContent: "center", opacity: fade }}>
        <Headline text={text} S={B} size={headlineSize(splitHeadline(text), B.font, T.w, width * 0.112)} align="center" />
      </div>
    );
  }
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
  if (look === "brand" && text?.trim()) return <BrandClose brand={brand} text={text} width={width} height={height} />;
  const S = look === "brand" ? brandPortraitStyle(brand) : portraitStyle(look, brand?.accent ?? "#FF2E88");
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

/**
 * The brand look's close: a reason to install as the headline ("Never lose a plant again"), with the app's icon and
 * name under it, already there on the first frame, over the last shot. Agency end cards give a reason, not just a name.
 */
function BrandClose({ brand, text, width, height }: { brand?: Brand; text: string; width: number; height: number }) {
  const frame = useCurrentFrame();
  const B = brandStyleOf(brand);
  const T = portraitLayout("brand", width, height).text;
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const icon = Math.round(width * 0.075);
  return (
    <div style={{ position: "absolute", left: T.x, top: T.y, width: T.w, height: T.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: width * 0.025, opacity: fade }}>
      <Headline text={text} S={B} size={headlineSize(splitHeadline(text), B.font, T.w, width * 0.095)} align="center" />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: width * 0.022 }}>
        <AppIcon brand={brand} size={icon} />
        <div style={{ ...brandType(B.font), color: B.ink, fontSize: Math.round(width * 0.05), lineHeight: 1 }}>{brand?.name ?? ""}</div>
      </div>
    </div>
  );
}

/** Close: icon, name and a short line, set in the look's type on its backdrop. */
export function PortraitEnd({ brand, text, look, width, height }: { brand?: Brand; text?: string; look: Look; width: number; height?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = look === "brand" ? brandPortraitStyle(brand) : portraitStyle(look, brand?.accent ?? "#FF2E88");
  const pop = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const late = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 120 } });
  const icon = Math.round(width * 0.26);
  const k = S.key(brand?.accent ?? "#FF2E88");
  return (
    <AbsoluteFill style={{ background: S.background, alignItems: "center", justifyContent: "center", gap: width * 0.05, padding: "10%" }}>
      {look === "brand" && height && <BrandBackdrop S={brandStyleOf(brand)} width={width} height={height} light={{ x: width / 2, y: height * 0.45 }} />}
      <div style={{ opacity: pop, transform: `translateY(${(1 - pop) * width * 0.04}px) scale(${0.94 + 0.06 * pop})` }}>
        <AppIcon brand={brand} size={icon} />
      </div>
      {/* Positioned, so they paint over the brand backdrop (itself absolutely positioned). */}
      <div style={{ ...S.type, position: "relative", textTransform: "none", color: S.ink, fontSize: lineSize(brand?.name ?? "", width, S.size * 1.1), textAlign: "center", opacity: pop }}>{brand?.name}</div>
      {text?.trim() && (
        <RevealWords
          text={text}
          delay={6}
          highlight={keyWord(text)}
          accent={k.accent}
          highlightStyle={k.style}
          style={{ ...S.type, position: "relative", color: S.muted, fontSize: lineSize(text, width, S.size * 0.62), justifyContent: "center", textAlign: "center" }}
        />
      )}
      <div style={{ ...UI, position: "relative", color: S.muted, fontSize: Math.round(width * 0.036), fontWeight: 500, letterSpacing: "0.02em", opacity: late }}>Download on the App Store</div>
    </AbsoluteFill>
  );
}

/** The brand look in the portrait style's terms, for the parts (brand line, end card) that share their layout. */
function brandPortraitStyle(brand?: Brand): PortraitStyle {
  const B = brandStyleOf(brand);
  return {
    background: `linear-gradient(170deg, ${B.bg}, ${B.bgDeep})`,
    ink: B.ink,
    muted: B.highlight,
    type: brandType(B.font),
    size: 0.1,
    key: () => ({ accent: B.highlight }),
    align: "center",
    grain: 0,
    push: () => 1,
  };
}
