import { AbsoluteFill, Easing, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { AppIcon, type Brand, DISPLAY, INK, PINK, UI, useEntrance, Words, YEL } from "./parts";

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

/**
 * Decorative phones outside the safe box, so the full-width frame on iPad and Mac reads as a row of screens
 * instead of empty space. They step out from the hero phone and the text column until they leave the frame;
 * devices that crop to the safe box never show them.
 */
export function flankBoxes(box: Box, phone: Box, width: number): (Box & { side: -1 | 1; step: number })[] {
  const h = Math.round(phone.height * 0.8);
  const w = Math.round(h * SCREEN_ASPECT);
  const gap = Math.round(phone.width * 0.3);
  const top = (step: number) => Math.round(phone.top + (phone.height - h) / 2 + (step % 2 ? -1 : 1) * phone.height * 0.05);
  const out: (Box & { side: -1 | 1; step: number })[] = [];
  for (let step = 1, x = phone.left + phone.width + gap; x < width; step++, x += w + gap) out.push({ left: x, top: top(step), width: w, height: h, side: 1, step });
  for (let step = 1, x = box.left - gap - w; x + w > 0; step++, x -= w + gap) out.push({ left: x, top: top(step), width: w, height: h, side: -1, step });
  return out;
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

/** Film grain: a tiny tile of noise, nudged every frame so it shimmers like footage instead of sitting still. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ backgroundImage: GRAIN, backgroundPosition: `${(frame * 73) % 240}px ${(frame * 151) % 240}px`, opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}
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
 * its screen, and a row of quieter phones beyond the safe box showing the other shots. Nothing re-enters
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
}: {
  shots: SceneShot[];
  width: number;
  height: number;
  safe?: SafeArea;
  loop: boolean;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const box = safeBox(width, height, safe);
  const phone = phoneBox(box, height);
  const col = textBox(box, phone);
  const flanks = flankBoxes(box, phone, width);
  const phase = (frame / Math.max(1, durationInFrames)) * Math.PI * 2;
  const sway = Math.sin(phase);
  const lift = Math.cos(phase);
  const glow = phone.height * 1.4;
  const cx = phone.left + phone.width / 2;
  const cy = phone.top + phone.height / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(${glow * 0.75}px ${glow * 0.6}px at ${cx}px ${cy}px, ${withAlpha(accent, 0.34)}, transparent)`,
            `radial-gradient(${col.width * 0.9}px ${col.height * 0.9}px at ${col.left + col.width * 0.3}px ${col.top + col.height * 0.5}px, ${withAlpha(accent, 0.1)}, transparent)`,
            `linear-gradient(180deg, ${withAlpha(accent, 0.05)}, transparent 40%, rgba(0,0,0,.35))`,
          ].join(", "),
        }}
      />
      {shots.map((s, i) => (
        <Sequence key={`g${i}`} from={s.from} durationInFrames={s.frames + (i < shots.length - 1 ? SWAP : 0)} layout="none">
          <AbsoluteFill style={{ opacity: 0.22 }}>
            <div
              style={{
                position: "absolute",
                left: cx - glow * 0.6,
                top: cy - glow / 2,
                width: glow * 1.2,
                height: glow,
                filter: `blur(${Math.round(height * 0.07)}px) saturate(2.4)`,
                WebkitMaskImage: "radial-gradient(closest-side, #000 35%, transparent)",
              }}
            >
              <MediaFill media={s.media} style={FILL} />
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
      <AbsoluteFill style={{ perspective: Math.round(height * 2.4) }}>
        {flanks.map((f, i) => {
          const shot = shots.length > 1 ? shots[(i + 1) % shots.length]! : shots[0];
          if (!shot) return null;
          const far = Math.min(1, (f.step - 1) / 2);
          const drift = sway * phone.width * 0.05 * f.side;
          return (
            <Phone
              key={`f${i}`}
              box={{ ...f, left: f.left + drift }}
              height={height}
              style={{ filter: `brightness(${0.4 - far * 0.12}) saturate(0.85)`, transform: `rotateY(${f.side * -16}deg)` }}
            >
              {/* A still a second into the shot: moving side phones would pull the eye off the hero. */}
              <Freeze frame={30}>
                <MediaFill media={shot.media} style={FILL} />
              </Freeze>
            </Phone>
          );
        })}
        <Phone
          box={{ ...phone, top: phone.top + lift * phone.height * 0.012 }}
          height={height}
          style={{ transform: `rotateY(${-9 + sway * 2.5}deg) rotateX(${2 + lift}deg)`, transformOrigin: "50% 50%" }}
        >
          {shots.map((s, i) => (
            <Sequence key={`h${i}`} from={s.from} durationInFrames={s.frames}>
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
      <AbsoluteFill style={{ background: `radial-gradient(75% 130% at 50% 50%, transparent 45%, rgba(4,4,7,.7) 100%)` }} />
      <Grain />
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

/** Words rise into place one after another from behind a mask, the way title designers set lines. */
function RevealWords({ text, style, highlight = -1, accent, delay = 0 }: { text: string; style: CSSProperties; highlight?: number; accent?: string; delay?: number }) {
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
}: {
  style: "hook" | "caption" | "brand" | undefined;
  text?: string;
  brand?: Brand;
  width: number;
  height: number;
  safe?: SafeArea;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leave = useLeave();
  const box = safeBox(width, height, safe);
  const col = textBox(box, phoneBox(box, height));
  const accent = brand?.accent ?? PINK;
  const out: CSSProperties = { opacity: 1 - leave, transform: `translateY(${-leave * 6}%)` };

  if (style === "brand") {
    const icon = Math.round(col.height * 0.34);
    const pop = spring({ frame, fps, config: { damping: 11, stiffness: 150, mass: 0.8 } });
    const sub = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <Column width={width} height={height} safe={safe}>
        <div style={{ display: "flex", alignItems: "center", gap: icon * 0.32, ...out }}>
          <div style={{ position: "relative", transform: `scale(${0.55 + 0.45 * pop})`, opacity: Math.min(1, pop * 1.5) }}>
            <div style={{ position: "absolute", inset: -icon * 0.35, borderRadius: "50%", background: `radial-gradient(closest-side, ${withAlpha(accent, 0.45)}, transparent)` }} />
            <AppIcon brand={brand} size={icon} />
          </div>
          <div style={{ minWidth: 0 }}>
            <RevealWords text={brand?.name ?? ""} delay={4} style={{ ...DISPLAY, color: "#F7F6FA", fontSize: columnFont(brand?.name ?? "", col, 0.24, 4) }} />
            <div style={{ ...UI, color: "#B4B3C0", fontWeight: 600, fontSize: Math.round(col.height * 0.075), marginTop: col.height * 0.03, opacity: sub, transform: `translateY(${(1 - sub) * 20}%)`, letterSpacing: "0.01em" }}>
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
        {hook ? (
          <div style={{ width: col.width * 0.16, height: Math.max(4, Math.round(col.height * 0.022)), background: accent, borderRadius: 99, marginBottom: col.height * 0.07, transform: `scaleX(${bar})`, transformOrigin: "left" }} />
        ) : (
          <div style={{ ...UI, color: accent, fontWeight: 700, fontSize: Math.round(col.height * 0.055), letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: col.height * 0.04, opacity: bar }}>
            {brand?.name}
          </div>
        )}
        <RevealWords
          text={line}
          highlight={hook ? keyWord(line) : -1}
          accent={accent}
          style={{ ...DISPLAY, color: "#F7F6FA", fontSize: columnFont(line, col, hook ? 0.27 : 0.19, hook ? 7.5 : 7.5), letterSpacing: "-0.005em" }}
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
