import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { AppIcon, type Brand, DISPLAY, INK, PINK, RevealWords, SERIF, UI, useEntrance, Words, YEL } from "./parts";

// Header (21:9) and search (3:2) layout. The portrait recording sits in a phone on the right of Apple's safe
// box, text sits on the left of it, and a blurred copy of the same media fills the rest of the frame.

export interface SafeArea {
  w: number;
  h: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The centred safe box in pixels of the full-size canvas. */
export function safeBox(width: number, height: number, safe: SafeArea = { w: 0.86, h: 0.8 }): Box {
  const w = Math.round(width * safe.w);
  const h = Math.round(height * safe.h);
  return { left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h };
}

/** Width over height of a phone recording once the status and home bars are cropped off (iPhone 15 to 17). */
export const SCREEN_ASPECT = 0.507;

/** Phone size and place: right part of the safe box, taller than it so the screen reads at small sizes. */
export function phoneBox(box: Box, canvasHeight: number): Box {
  const height = Math.round(Math.min(canvasHeight * 0.9, box.height * 1.42));
  const width = Math.round(height * SCREEN_ASPECT);
  const centreX = Math.min(box.left + box.width * 0.78, box.left + box.width - width / 2);
  return { left: Math.round(centreX - width / 2), top: Math.round(box.top + box.height / 2 - height / 2), width, height };
}

/**
 * The text column: left part of the safe box, clear of the phone, with a margin inside the box so the tightest
 * crop (the safe box itself, on iPhone) never has words touching its edge.
 */
export function textBox(box: Box, phone: Box): Box {
  const gap = Math.round(box.width * 0.05);
  const left = box.left + Math.round(box.width * 0.04);
  const top = box.top + Math.round(box.height * 0.08);
  return { left, top, width: Math.max(0, phone.left - gap - left), height: Math.round(box.height * 0.84) };
}

/** Font size that fits a line into the text column in about three lines. */
export function columnFont(text: string, col: Box, maxShare: number, perLine = 6): number {
  const chars = Math.max(12, text.trim().length);
  return Math.round(Math.min(col.height * maxShare, (col.width * perLine) / chars));
}

export type Media = { kind: "video"; src: string; trimBefore: number } | { kind: "image"; src: string };

function MediaFill({ media, style }: { media: Media; style: CSSProperties }) {
  return media.kind === "video" ? (
    <OffthreadVideo src={media.src} muted trimBefore={media.trimBefore} style={style} />
  ) : (
    <Img src={media.src} style={style} />
  );
}

const FILL: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };


/**
 * Header and search looks, each copied from a named reference among top apps' App Store videos. A look sets
 * the light, the type and the one camera move; the cut (which shots, which words) is the same for all of them.
 * - studio: one phone on a quiet dark backdrop lit in the app's colour.
 * - cinematic: Claude's App Preview: warm low-key light, one serif line, one slow push in, no sway.
 * - bold: Strava's App Preview: the app's own colour as the stage, heavy type, the phone straight on.
 */
export type Look = "studio" | "cinematic" | "bold";
export const LOOKS: Look[] = ["studio", "cinematic", "bold"];

/** Relative luminance of "#RRGGBB" (0 black to 1 white). */
function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}

interface LookStyle {
  base: string;
  /** Light on the stage, as CSS background layers, given the phone's centre and size. */
  light: (accent: string, cx: number, cy: number, phone: Box) => string;
  ink: string;
  muted: string;
  /** Hook and caption type; `size` scales the column-fit font. */
  type: CSSProperties;
  size: number;
  /** How the hook's key word stands out. */
  key: (accent: string) => { accent?: string; style?: CSSProperties };
  /** Accent bar over the hook and the app name over captions. */
  kicker: boolean;
  /** Phone turned towards the words (degrees) and how far it sways over the loop. */
  tilt: number;
  sway: number;
  /** The camera's one move: scale of the whole stage at a point of the video (0..1, `loop` keeps it seamless). */
  push: (t: number, loop: boolean) => number;
  grain: number;
  vignette: string;
}

const WARM = "#FFB37A";

export function lookStyle(look: Look, accent: string): LookStyle {
  if (look === "cinematic") {
    return {
      base: "#0D0A08",
      light: (a, cx, cy, p) =>
        [
          `radial-gradient(${p.height * 0.9}px ${p.height * 0.75}px at ${cx - p.width * 0.6}px ${cy - p.height * 0.35}px, ${withAlpha(WARM, 0.2)}, transparent)`,
          `radial-gradient(${p.height * 0.6}px ${p.height * 0.5}px at ${cx}px ${cy}px, ${withAlpha(a, 0.07)}, transparent)`,
          `linear-gradient(180deg, transparent 50%, rgba(0,0,0,.45))`,
        ].join(", "),
      ink: "#F4EEE6",
      muted: "#BDB2A6",
      type: { ...SERIF, letterSpacing: "-0.01em" },
      size: 1.18,
      key: () => ({ style: { fontStyle: "italic" } }),
      kicker: false,
      tilt: -12,
      sway: 0,
      // In and back out over a loop, so the seam has nothing to jump; a straight slow push otherwise.
      push: (t, loop) => 1 + 0.045 * (loop ? (1 - Math.cos(t * Math.PI * 2)) / 2 : Easing.inOut(Easing.quad)(t)),
      grain: 0.1,
      vignette: "radial-gradient(70% 120% at 50% 45%, transparent 40%, rgba(8,5,3,.8) 100%)",
    };
  }
  if (look === "bold") {
    const light = luminance(accent) > 0.4;
    return {
      base: accent,
      light: (_a, cx, cy, p) =>
        [
          `radial-gradient(${p.height}px ${p.height * 0.8}px at ${cx}px ${cy - p.height * 0.2}px, rgba(255,255,255,.16), transparent)`,
          `linear-gradient(180deg, transparent 55%, rgba(0,0,0,.18))`,
        ].join(", "),
      ink: light ? INK : "#FFFFFF",
      muted: light ? "rgba(10,10,14,.7)" : "rgba(255,255,255,.78)",
      type: { ...DISPLAY, textTransform: "uppercase", letterSpacing: "0.005em" },
      size: 1,
      key: () => ({ style: { textDecoration: "underline", textDecorationThickness: "0.08em", textUnderlineOffset: "0.12em" } }),
      kicker: false,
      tilt: 0,
      sway: 0,
      // One move: the phone stage rises a touch and settles, like a product shot landing.
      push: (t) => 1 + 0.03 * (1 - Easing.out(Easing.cubic)(Math.min(1, t * 6))),
      grain: 0.04,
      vignette: "radial-gradient(85% 140% at 50% 50%, transparent 55%, rgba(0,0,0,.18) 100%)",
    };
  }
  return {
    base: INK,
    light: (a, cx, cy, p) =>
      [
        `radial-gradient(${p.height * 0.75}px ${p.height * 0.6}px at ${cx}px ${cy}px, ${withAlpha(a, 0.13)}, transparent)`,
        `linear-gradient(180deg, rgba(255,255,255,.035), transparent 45%, rgba(0,0,0,.4))`,
      ].join(", "),
    ink: "#F7F6FA",
    muted: "#B4B3C0",
    type: { ...DISPLAY, letterSpacing: "-0.005em" },
    size: 1,
    key: (a) => ({ accent: a }),
    kicker: true,
    tilt: -9,
    sway: 2.5,
    push: () => 1,
    grain: 0.07,
    vignette: "radial-gradient(75% 130% at 50% 50%, transparent 45%, rgba(4,4,7,.7) 100%)",
  };
}

/** Film grain: a tiny tile of noise, nudged every frame so it shimmers like footage instead of sitting still. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function Grain({ opacity }: { opacity: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ backgroundImage: GRAIN, backgroundPosition: `${(frame * 73) % 240}px ${(frame * 151) % 240}px`, opacity, mixBlendMode: "overlay", pointerEvents: "none" }}
    />
  );
}

/** A phone: thin dark bezel with a lit edge, rounded screen, glass sheen and a soft shadow. */
function Phone({ box, height, children, style }: { box: Box; height: number; children: ReactNode; style?: CSSProperties }) {
  const bezel = Math.max(3, Math.round(box.width * 0.028));
  const radius = Math.round(box.width * 0.14);
  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        borderRadius: radius,
        border: `${bezel}px solid #121217`,
        boxShadow: [
          `0 0 0 ${Math.max(1, Math.round(bezel / 3))}px rgba(255,255,255,.22)`,
          `inset 0 0 0 ${Math.max(1, Math.round(bezel / 4))}px rgba(255,255,255,.06)`,
          `0 ${Math.round(height * 0.03)}px ${Math.round(height * 0.08)}px rgba(0,0,0,.6)`,
        ].join(", "),
        overflow: "hidden",
        backgroundColor: "#000",
        ...style,
      }}
    >
      {children}
      <AbsoluteFill style={{ background: "linear-gradient(118deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,.05) 100%)", pointerEvents: "none" }} />
    </div>
  );
}

export interface SceneShot {
  media: Media;
  /** Frames from the start of the video. */
  from: number;
  frames: number;
}

/** Frames of the hero screen's crossfade from one shot to the next. */
const SWAP = 9;
/** Frames the light sweep takes to cross the glass on a shot change. */
const GLARE = 16;

/** The hero phone's screen for one shot: settles in over the previous one with a sweep of light (the first shot just shows). */
function HeroScreen({ media, first }: { media: Media; first: boolean }) {
  const frame = useCurrentFrame();
  const t = first ? 1 : interpolate(frame, [0, SWAP], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const g = interpolate(frame, [0, GLARE], [-0.6, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: t, transform: `scale(${1.05 - 0.05 * t})` }}>
        <MediaFill media={media} style={FILL} />
      </AbsoluteFill>
      {!first && frame < GLARE && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(105deg, transparent ${g * 100 - 22}%, rgba(255,255,255,.42) ${g * 100}%, transparent ${g * 100 + 22}%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
    </AbsoluteFill>
  );
}

/** "#RRGGBB" plus an alpha, as an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Header (21:9) and search (3:2) stage, held for the whole video: a dark backdrop lit in the app's own colour,
 * the hero phone on the right of Apple's safe box, turned a little towards the words, with each shot cut into
 * its screen. One phone and a quiet backdrop: copies of the phone around it read as a stock template. Nothing re-enters
 * between shots, so the cut reads as one product moment, and every motion runs one full cycle over the video so
 * a looping header has nothing to jump.
 */
export function LandscapeScene({
  shots,
  width,
  height,
  safe,
  loop,
  accent = PINK,
  look = "studio",
}: {
  shots: SceneShot[];
  width: number;
  height: number;
  safe?: SafeArea;
  loop: boolean;
  accent?: string;
  look?: Look;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const box = safeBox(width, height, safe);
  const phone = phoneBox(box, height);
  const L = lookStyle(look, accent);
  const t = frame / Math.max(1, durationInFrames);
  const phase = t * Math.PI * 2;
  const sway = Math.sin(phase);
  const lift = Math.cos(phase);
  const cx = phone.left + phone.width / 2;
  const cy = phone.top + phone.height / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: L.base, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: L.light(accent, cx, cy, phone) }} />
      {/* The camera's one move scales the whole stage about the phone, so the words beside it stay put. */}
      <AbsoluteFill style={{ transform: `scale(${L.push(t, loop)})`, transformOrigin: `${cx}px ${cy}px` }}>
      <div
        style={{
          position: "absolute",
          left: cx - phone.width * 0.7,
          top: phone.top + phone.height * 0.93,
          width: phone.width * 1.4,
          height: phone.height * 0.12,
          background: "radial-gradient(closest-side, rgba(0,0,0,.55), transparent)",
          filter: `blur(${Math.round(height * 0.012)}px)`,
        }}
      />
      <AbsoluteFill style={{ perspective: Math.round(height * 2.4) }}>
        <Phone
          box={{ ...phone, top: phone.top + (L.sway ? lift * phone.height * 0.012 : 0) }}
          height={height}
          style={{ transform: `rotateY(${L.tilt + sway * L.sway}deg) rotateX(${L.sway ? 2 + lift : 0}deg)`, transformOrigin: "50% 50%" }}
        >
          {shots.map((s, i) => (
            // Each screen stays up under the next one's crossfade, so a cut never dips through black.
            <Sequence key={`h${i}`} from={s.from} durationInFrames={s.frames + (i < shots.length - 1 ? SWAP : 0)}>
              <HeroScreen media={s.media} first={i === 0} />
            </Sequence>
          ))}
          {loop && shots.length > 1 && durationInFrames > 60 && (
            <Sequence from={durationInFrames - 15} durationInFrames={15}>
              <AbsoluteFill style={{ opacity: interpolate(frame - (durationInFrames - 15), [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                <MediaFill media={shots[0]!.media} style={FILL} />
              </AbsoluteFill>
            </Sequence>
          )}
        </Phone>
      </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: L.vignette }} />
      <Grain opacity={L.grain} />
    </AbsoluteFill>
  );
}

function Column({ width, height, safe, children, align = "center" }: { width: number; height: number; safe?: SafeArea; children: ReactNode; align?: "center" | "flex-end" }) {
  const box = safeBox(width, height, safe);
  const col = textBox(box, phoneBox(box, height));
  return (
    <div style={{ position: "absolute", left: col.left, top: col.top, width: col.width, height: col.height, display: "flex", flexDirection: "column", justifyContent: align }}>
      {children}
    </div>
  );
}

const STOP = new Set("a an the to of in on for and or but with your you my our it its is are be at by from as this that so up out off again ever never no not every all any more less get got".split(" "));

/** The word a hook leans on, to set in the accent colour: its longest content word (the later one on a tie). */
export function keyWord(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  let best = -1;
  let len = 0;
  words.forEach((w, i) => {
    const bare = w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
    if (STOP.has(bare) || bare.length < 3) return;
    if (bare.length >= len) {
      best = i;
      len = bare.length;
    }
  });
  return best;
}

/** Ease the whole block up and out over the last frames of an overlay. */
function useLeave() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
}

/** Hook, caption or brand line in the text column beside the phone. */
export function LandscapeOverlay({
  style,
  text,
  brand,
  width,
  height,
  safe,
  look = "studio",
}: {
  style: "hook" | "caption" | "brand" | undefined;
  text?: string;
  brand?: Brand;
  width: number;
  height: number;
  safe?: SafeArea;
  look?: Look;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leave = useLeave();
  const box = safeBox(width, height, safe);
  const col = textBox(box, phoneBox(box, height));
  const accent = brand?.accent ?? PINK;
  const L = lookStyle(look, accent);
  const out: CSSProperties = { opacity: 1 - leave, transform: `translateY(${-leave * 6}%)` };

  if (style === "brand") {
    const icon = Math.round(col.height * 0.34);
    const pop = spring({ frame, fps, config: { damping: 11, stiffness: 150, mass: 0.8 } });
    const sub = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <Column width={width} height={height} safe={safe}>
        <div style={{ display: "flex", alignItems: "center", gap: icon * 0.32, ...out }}>
          <div style={{ position: "relative", transform: `scale(${0.55 + 0.45 * pop})`, opacity: Math.min(1, pop * 1.5) }}>
            {look === "studio" && (
              <div style={{ position: "absolute", inset: -icon * 0.35, borderRadius: "50%", background: `radial-gradient(closest-side, ${withAlpha(accent, 0.45)}, transparent)` }} />
            )}
            <AppIcon brand={brand} size={icon} />
          </div>
          <div style={{ minWidth: 0 }}>
            <RevealWords text={brand?.name ?? ""} delay={4} style={{ ...L.type, color: L.ink, fontSize: columnFont(brand?.name ?? "", col, 0.24 * L.size, 4) }} />
            <div style={{ ...UI, color: L.muted, fontWeight: 600, fontSize: Math.round(col.height * 0.075), marginTop: col.height * 0.03, opacity: sub, transform: `translateY(${(1 - sub) * 20}%)`, letterSpacing: "0.01em" }}>
              {text?.trim() || "On the App Store"}
            </div>
          </div>
        </div>
      </Column>
    );
  }

  const hook = style !== "caption";
  const line = text ?? "";
  const bar = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <Column width={width} height={height} safe={safe}>
      <div style={out}>
        {!L.kicker ? null : hook ? (
          <div style={{ width: col.width * 0.16, height: Math.max(4, Math.round(col.height * 0.022)), background: accent, borderRadius: 99, marginBottom: col.height * 0.07, transform: `scaleX(${bar})`, transformOrigin: "left" }} />
        ) : (
          <div style={{ ...UI, color: accent, fontWeight: 700, fontSize: Math.round(col.height * 0.055), letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: col.height * 0.04, opacity: bar }}>
            {brand?.name}
          </div>
        )}
        <RevealWords
          text={line}
          highlight={hook ? keyWord(line) : -1}
          accent={L.key(accent).accent}
          highlightStyle={L.key(accent).style}
          style={{ ...L.type, color: L.ink, fontSize: columnFont(line, col, (hook ? 0.27 : 0.19) * L.size, 7.5 / L.size) }}
        />
      </div>
    </Column>
  );
}

/** A full-frame text card, with the words kept inside the safe box. */
export function LandscapeCard({ text, width, height, safe }: { text: string; width: number; height: number; safe?: SafeArea }) {
  const box = safeBox(width, height, safe);
  const enter = useEntrance(1);
  return (
    <AbsoluteFill style={{ backgroundColor: YEL, opacity: enter.opacity }}>
      <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Words text={text} style={{ ...DISPLAY, color: INK, fontSize: columnFont(text, box, 0.4, 5), textAlign: "center", justifyContent: "center" }} />
      </div>
    </AbsoluteFill>
  );
}
