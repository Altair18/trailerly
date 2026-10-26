import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { type BrandFont, type BrandStyle, paletteFromAccent } from "@/lib/media/palette";
import { type Box, cropStyle, type Media, type SafeArea, type SceneShot, safeBox, withAlpha } from "./Landscape";
import { AppIcon, type Brand, PINK, SERIF, UI } from "./parts";

// The "brand" look, built from the agency benchmark (AppVideos.co's iOS 27 header and search samples among 13
// agency videos): every frame is dressed in the app's own colours and type, the app's screens fill the frame as
// flat cards (no device frame, no tilt), the words are already on screen at frame 1 and never animate in word by
// word, and the only motion is the content changing inside the cards. No camera moves.

export const brandStyleOf = (brand?: Brand): BrandStyle => brand?.style ?? paletteFromAccent(brand?.accent ?? PINK);

export function brandType(font: BrandFont): CSSProperties {
  if (font === "editorial") return { ...SERIF, letterSpacing: "-0.01em", lineHeight: 1.0 };
  if (font === "condensed") return { fontFamily: "Archivo, sans-serif", fontStretch: "78%", fontWeight: 850, letterSpacing: "-0.01em", lineHeight: 0.98 };
  return { fontFamily: "Geist, system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02 };
}

/** Average glyph width as a share of the font size, for fitting lines. */
const GLYPH: Record<BrandFont, number> = { geometric: 0.53, condensed: 0.44, editorial: 0.42 };

/**
 * A headline in two tones, the way agencies set it ("Snap a photo." / "Know what it is."): the first part in white,
 * the second in the highlight colour. Splits at a sentence or clause break when there is one, else at the middle word.
 */
export function splitHeadline(text: string): [string, string] {
  const t = text.trim().replace(/\s+/g, " ");
  const punct = t.search(/[.!?,:;—–] /);
  if (punct > 0 && punct < t.length - 3) return [t.slice(0, punct + 1), t.slice(punct + 2)];
  const words = t.split(" ");
  if (words.length < 4) return [t, ""];
  // The split that makes the two lines closest in length.
  let best = 1;
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < gap) {
      gap = d;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** Font size that sets each part of the headline on one line (or two, for long ones) within `width`. */
export function headlineSize(parts: string[], font: BrandFont, width: number, max: number): number {
  const longest = Math.max(8, ...parts.map((p) => p.length));
  const oneLine = width / (longest * GLYPH[font]);
  return Math.round(Math.min(max, Math.max(oneLine, max * 0.55)));
}

/** Fade in over the first frames (unless the overlay opens the video) and out over the last ones. */
function useCrossfade(fadeIn: boolean, fadeOut: boolean) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = fadeIn ? interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }) : 1;
  const b = fadeOut ? interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return Math.min(a, b);
}

/**
 * The highlighter block agencies set their key words on (SatStacker, EarthSnap): a solid slab of the highlight colour
 * with the words in the backdrop's deep colour, so the line reads at thumbnail size on any frame.
 */
export function blockStyle(S: BrandStyle): CSSProperties {
  return {
    color: S.bgDeep,
    background: S.highlight,
    padding: "0.02em 0.18em 0.06em",
    borderRadius: "0.14em",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}

/**
 * A headline in two tones, the way agencies set it ("Snap a photo." / "Know what it is."): the first part in the ink
 * colour, the second on a highlighter block. A short line keeps one row and blocks its last word.
 */
export function Headline({ text, S, size, align = "left", style }: { text: string; S: BrandStyle; size: number; align?: "left" | "center"; style?: CSSProperties }) {
  const [a, b] = splitHeadline(text);
  const words = a.split(" ");
  const short = !b && words.length >= 2;
  return (
    <div style={{ ...brandType(S.font), position: "relative", fontSize: size, color: S.ink, textAlign: align, ...style }}>
      {short ? (
        <div>
          {words.slice(0, -1).join(" ")} <span style={blockStyle(S)}>{words[words.length - 1]}</span>
        </div>
      ) : (
        <div>{a}</div>
      )}
      {b && (
        <div style={{ marginTop: "0.08em" }}>
          <span style={blockStyle(S)}>{b}</span>
        </div>
      )}
    </div>
  );
}

/** The app's backdrop: its colour in a soft diagonal gradient, a pool of light behind the screens and a faint dashed curve. */
export function BrandBackdrop({ S, width, height, light }: { S: BrandStyle; width: number; height: number; light: { x: number; y: number } }) {
  const stroke = Math.max(2, Math.round(Math.min(width, height) * 0.004));
  return (
    <AbsoluteFill style={{ background: `linear-gradient(110deg, ${S.bgDeep} 0%, ${S.bg} 58%, ${S.bg} 100%)` }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(${width * 0.45}px ${height * 0.7}px at ${light.x}px ${light.y}px, ${withAlpha(S.highlight, 0.16)}, transparent 70%)` }}
      />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M ${-width * 0.05} ${height * 0.82} C ${width * 0.3} ${height * 0.62}, ${width * 0.6} ${height * 1.02}, ${width * 1.05} ${height * 0.7}`}
          fill="none"
          stroke={withAlpha(S.highlight, 0.22)}
          strokeWidth={stroke}
          strokeDasharray={`${stroke * 4} ${stroke * 5}`}
        />
      </svg>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.18))" }} />
    </AbsoluteFill>
  );
}

function MediaFill({ media, style }: { media: Media; style: CSSProperties }) {
  return media.kind === "video" ? <OffthreadVideo src={media.src} muted trimBefore={media.trimBefore} style={style} /> : <Img src={media.src} style={{ ...style, ...cropStyle(media.crop) }} />;
}

/** Frames a card's content takes to change over to the next shot. */
const CHANGE = 12;

/** The shot showing at `frame` (index into `shots`), and how far into its change-over it is (0..1). */
function shotAt(shots: SceneShot[], frame: number): { i: number; t: number } {
  let i = 0;
  shots.forEach((s, k) => {
    if (frame >= s.from) i = k;
  });
  const t = i === 0 ? 1 : interpolate(frame - shots[i]!.from, [0, CHANGE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return { i, t };
}

/**
 * A flat screen card whose content changes from one shot to the next: the new screen rises a touch and fades in
 * over the old one, which stays put underneath, so a change never dips to the backdrop.
 */
function Card({
  box,
  shots,
  pick,
  radius,
  shadow,
  dim = 0,
  dimColour,
  outline,
  scale = 1,
  position = "50% 0%",
}: {
  box: Box;
  shots: SceneShot[];
  /** Which shot this card shows while shot `i` is the current one. */
  pick: (i: number) => number;
  radius: number;
  shadow: string;
  dim?: number;
  dimColour?: string;
  outline?: string;
  scale?: number;
  position?: string;
}) {
  const frame = useCurrentFrame();
  const { i, t } = shotAt(shots, frame);
  const now = pick(i);
  const before = i > 0 ? pick(i - 1) : now;
  const fill: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: position };
  const media = (k: number) => shots[((k % shots.length) + shots.length) % shots.length]!.media;
  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        borderRadius: radius,
        overflow: "hidden",
        background: "#000",
        boxShadow: [shadow, outline ? `0 0 0 ${outline}` : ""].filter(Boolean).join(", "),
        transform: `scale(${scale})`,
      }}
    >
      {now !== before && t < 1 && <MediaFill media={media(before)} style={fill} />}
      <div style={{ position: "absolute", inset: 0, opacity: now !== before ? t : 1, transform: now !== before ? `translateY(${(1 - t) * 3}%)` : undefined }}>
        <MediaFill media={media(now)} style={fill} />
      </div>
      {dim > 0 && <div style={{ position: "absolute", inset: 0, background: dimColour ?? "#000", opacity: dim }} />}
    </div>
  );
}

const cardShadow = (h: number) => `0 ${Math.round(h * 0.025)}px ${Math.round(h * 0.07)}px rgba(0,0,0,.45)`;

// ---------------------------------------------------------------------------------------------------------
// Header (21:9)

/** Screen cards are about this wide for their height (store screenshots 0.46, cropped recordings 0.51). */
const CARD_ASPECT = 0.47;

export interface HeaderLayout {
  text: Box;
  hero: Box;
  sides: Array<{ box: Box; offset: number }>;
}

/**
 * Header: the words in the left part of Apple's safe box, the hero screen card at 80% of the frame's height in its
 * right part, and the app's other screens, dimmed, carrying on out to both edges so no part of the frame is empty.
 */
export function headerLayout(width: number, height: number, safe?: SafeArea): HeaderLayout {
  const box = safeBox(width, height, safe);
  const h = Math.round(height * 0.8);
  const w = Math.round(h * CARD_ASPECT);
  const cx = box.left + box.width * 0.8;
  const hero = { left: Math.round(Math.min(cx - w / 2, box.left + box.width - w)), top: Math.round((height - h) / 2), width: w, height: h };
  const gap = Math.round(height * 0.04);
  const textLeft = box.left + Math.round(box.width * 0.03);
  const text = { left: textLeft, top: box.top, width: hero.left - Math.round(box.width * 0.05) - textLeft, height: box.height };
  const sh = Math.round(h * 0.78);
  const sw = Math.round(sh * CARD_ASPECT);
  const top = Math.round((height - sh) / 2);
  const sides: HeaderLayout["sides"] = [];
  for (let x = hero.left + w + gap, k = 1; x < width; x += sw + gap, k++) sides.push({ box: { left: x, top, width: sw, height: sh }, offset: k });
  for (let x = box.left - gap - sw, k = -1; x + sw > 0; x -= sw + gap, k--) sides.push({ box: { left: x, top, width: sw, height: sh }, offset: k });
  return { text, hero, sides };
}

/**
 * The header holds one line for its whole loop (the hook, under the wordmark): top apps' headers read as a calm
 * banner, not a slideshow. Every other overlay is dropped. Cards beyond the hero's neighbours hold still.
 */
export function heldHeaderLine<T extends { start: number; duration: number; style?: string; text?: string }>(overlays: T[], total: number): T[] {
  const line = overlays.find((o) => o.style === "hook" && o.text?.trim()) ?? overlays.find((o) => o.style !== "brand" && o.text?.trim());
  return line ? [{ ...line, start: 0, duration: total }] : overlays;
}

export function BrandHeaderScene({ shots, width, height, safe, brand }: { shots: SceneShot[]; width: number; height: number; safe?: SafeArea; brand?: Brand }) {
  const S = brandStyleOf(brand);
  const L = headerLayout(width, height, safe);
  const radius = Math.round(L.hero.width * 0.07);
  const unique = new Set(shots.map((s) => s.media.src)).size;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BrandBackdrop S={S} width={width} height={height} light={{ x: L.hero.left + L.hero.width / 2, y: height * 0.45 }} />
      {shots.length > 0 && (
        <>
          {unique > 1 &&
            L.sides.map(({ box, offset }) => (
              <Card key={offset} box={box} shots={shots} pick={Math.abs(offset) === 1 ? (i) => i + offset : () => offset}
                radius={Math.round(box.width * 0.07)}
                shadow={cardShadow(height)}
                dim={Math.abs(offset) === 1 ? 0.7 : 0.84} dimColour={S.bgDeep} />
            ))}
          <Card box={L.hero} shots={shots} pick={(i) => i} radius={radius} shadow={`${cardShadow(height)}, 0 0 0 ${Math.max(2, Math.round(height * 0.003))}px rgba(255,255,255,.12)`} />
        </>
      )}
    </AbsoluteFill>
  );
}

/** The header's words: a small wordmark over the two-tone headline, or the icon and name for the close. */
export function BrandHeaderOverlay({
  style,
  text,
  brand,
  width,
  height,
  safe,
  first,
  last,
}: {
  style: "hook" | "caption" | "brand" | undefined;
  text?: string;
  brand?: Brand;
  width: number;
  height: number;
  safe?: SafeArea;
  first: boolean;
  last: boolean;
}) {
  const S = brandStyleOf(brand);
  const L = headerLayout(width, height, safe);
  const opacity = useCrossfade(!first, !last);
  const col = L.text;
  const column: CSSProperties = { position: "absolute", left: col.left, top: col.top, width: col.width, height: col.height, display: "flex", flexDirection: "column", justifyContent: "center", opacity };
  if (style === "brand") {
    const icon = Math.round(col.height * 0.36);
    return (
      <div style={column}>
        <div style={{ display: "flex", alignItems: "center", gap: icon * 0.3 }}>
          <AppIcon brand={brand} size={icon} />
          <div>
            <div style={{ ...brandType(S.font), color: S.ink, fontSize: headlineSize([brand?.name ?? ""], S.font, col.width - icon * 1.3, col.height * 0.26) }}>{brand?.name}</div>
            <div style={{ ...UI, color: S.highlight, fontWeight: 700, fontSize: Math.round(col.height * 0.08), marginTop: col.height * 0.03 }}>{text?.trim() || "On the App Store"}</div>
          </div>
        </div>
      </div>
    );
  }
  const line = text ?? "";
  const size = headlineSize(splitHeadline(line), S.font, col.width, col.height * 0.25);
  return (
    <div style={column}>
      <Wordmark brand={brand} S={S} size={Math.round(col.height * 0.075)} />
      <Headline text={line} S={S} size={size} />
    </div>
  );
}

function Wordmark({ brand, S, size, align = "left" }: { brand?: Brand; S: BrandStyle; size: number; align?: "left" | "center" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.45, marginBottom: size * 0.7, justifyContent: align === "center" ? "center" : "flex-start" }}>
      <AppIcon brand={brand} size={Math.round(size * 1.45)} />
      <span style={{ ...UI, fontWeight: 700, color: S.ink, opacity: 0.92, fontSize: size, letterSpacing: "-0.01em" }}>{brand?.name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Search (3:2)

export interface SearchLayout {
  text: Box;
  cards: Box[];
}

/** Search: the headline large across the top of the safe box, three screen cards in a row along the bottom half. */
export function searchLayout(width: number, height: number, safe?: SafeArea): SearchLayout {
  const box = safeBox(width, height, safe);
  const top = Math.round(height * 0.52);
  const margin = Math.round(width * 0.05);
  const gap = Math.round(width * 0.022);
  const w = Math.round((width - margin * 2 - gap * 2) / 3);
  const h = Math.round(height * 0.43);
  const cards = [0, 1, 2].map((k) => ({ left: margin + k * (w + gap), top, width: w, height: h }));
  const textTop = Math.round(height * 0.12);
  return { text: { left: box.left, top: textTop, width: box.width, height: top - textTop - Math.round(height * 0.04) }, cards };
}

/** Which card is lit while shot `i` is up, and which shot each card shows. */
export function spotlight(i: number, count: number): { active: number; shows: (card: number) => number } {
  const active = i % 3;
  return {
    active,
    // Each card shows its own shot until the spotlight comes round to it again with a later one.
    shows: (card) => Math.max(0, Math.min(count - 1, i >= card ? card + 3 * Math.floor((i - card) / 3) : card)),
  };
}

export function BrandSearchScene({ shots, width, height, safe, brand }: { shots: SceneShot[]; width: number; height: number; safe?: SafeArea; brand?: Brand }) {
  const frame = useCurrentFrame();
  const S = brandStyleOf(brand);
  const L = searchLayout(width, height, safe);
  const { i, t } = shotAt(shots, frame);
  const now = spotlight(i, shots.length);
  const prev = spotlight(Math.max(0, i - 1), shots.length);
  const radius = Math.round(L.cards[0]!.width * 0.05);
  const ring = Math.max(3, Math.round(height * 0.005));
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BrandBackdrop S={S} width={width} height={height} light={{ x: width / 2, y: height * 0.7 }} />
      {shots.length > 0 &&
        L.cards.map((box, card) => {
          // The light moves from the last card to the new one over the change-over.
          const lit = (card === now.active ? t : 0) + (card === prev.active && i > 0 && prev.active !== now.active ? 1 - t : 0) + (i === 0 && card === 0 ? 1 : 0);
          const on = Math.min(1, lit);
          return (
            <Card
              key={card}
              box={box}
              shots={shots}
              pick={(k) => spotlight(k, shots.length).shows(card)}
              radius={radius}
              shadow={cardShadow(height)}
              dim={0.5 * (1 - on)}
              dimColour={S.bgDeep}
              outline={on > 0.02 ? `${ring}px ${withAlpha(S.highlight, on)}` : undefined}
              scale={1 + 0.06 * on}
            />
          );
        })}
    </AbsoluteFill>
  );
}

export function BrandSearchOverlay({
  style,
  text,
  brand,
  width,
  height,
  safe,
  first,
  last,
}: {
  style: "hook" | "caption" | "brand" | undefined;
  text?: string;
  brand?: Brand;
  width: number;
  height: number;
  safe?: SafeArea;
  first: boolean;
  last: boolean;
}) {
  const S = brandStyleOf(brand);
  const L = searchLayout(width, height, safe);
  const opacity = useCrossfade(!first, !last);
  const col = L.text;
  const column: CSSProperties = { position: "absolute", left: col.left, top: col.top, width: col.width, height: col.height, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", opacity };
  if (style === "brand") {
    const icon = Math.round(col.height * 0.5);
    return (
      <div style={column}>
        <div style={{ display: "flex", alignItems: "center", gap: icon * 0.3 }}>
          <AppIcon brand={brand} size={icon} />
          <div>
            <div style={{ ...brandType(S.font), color: S.ink, fontSize: Math.round(col.height * 0.3) }}>{brand?.name}</div>
            <div style={{ ...UI, color: S.highlight, fontWeight: 700, fontSize: Math.round(col.height * 0.11), marginTop: col.height * 0.03 }}>{text?.trim() || "On the App Store"}</div>
          </div>
        </div>
      </div>
    );
  }
  const line = text ?? "";
  return (
    <div style={column}>
      <Headline text={line} S={S} size={headlineSize(splitHeadline(line), S.font, col.width, col.height * 0.42)} align="center" />
    </div>
  );
}

/** Wraps the brand backdrop around children (portrait stage). */
export function BrandStage({ brand, width, height, children }: { brand?: Brand; width: number; height: number; children: ReactNode }) {
  const S = brandStyleOf(brand);
  return (
    <AbsoluteFill>
      <BrandBackdrop S={S} width={width} height={height} light={{ x: width * 0.5, y: height * 0.55 }} />
      {children}
    </AbsoluteFill>
  );
}
