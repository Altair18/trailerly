import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { AppIcon, type Brand, DISPLAY, INK, PINK, PUSH_IN, UI, useEntrance, useExit, Words, YEL } from "./parts";

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

/** Phone size and place: right part of the safe box, a little taller than it so the screen reads at small sizes. */
export function phoneBox(box: Box, canvasHeight: number): Box {
  const height = Math.round(Math.min(canvasHeight * 0.88, box.height * 1.35));
  const width = Math.round(height * (9 / 19.5));
  const centreX = box.left + box.width * 0.76;
  return { left: Math.round(centreX - width / 2), top: Math.round(box.top + box.height / 2 - height / 2), width, height };
}

/** The text column: left part of the safe box, clear of the phone. */
export function textBox(box: Box, phone: Box): Box {
  const gap = Math.round(box.width * 0.04);
  return { left: box.left, top: box.top, width: Math.max(0, phone.left - gap - box.left), height: box.height };
}

/** Font size that fits a line into the text column in about three lines. */
export function columnFont(text: string, col: Box, maxShare: number, perLine = 6): number {
  const chars = Math.max(12, text.trim().length);
  return Math.round(Math.min(col.height * maxShare, (col.width * perLine) / chars));
}

type Media = { kind: "video"; src: string; trimBefore: number } | { kind: "image"; src: string };

function MediaFill({ media, style }: { media: Media; style: CSSProperties }) {
  return media.kind === "video" ? (
    <OffthreadVideo src={media.src} muted trimBefore={media.trimBefore} style={style} />
  ) : (
    <Img src={media.src} style={style} />
  );
}

/** One screen or screenshot segment on the landscape stage. */
export function Stage({ media, index, width, height, safe }: { media: Media; index: number; width: number; height: number; safe?: SafeArea }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = useEntrance(index);
  const box = safeBox(width, height, safe);
  const phone = phoneBox(box, height);
  const rise = index === 0 ? 1 : spring({ frame, fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 14 });
  const zoom = 1 + (PUSH_IN / 2) * interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const bezel = Math.max(3, Math.round(phone.width * 0.035));
  const fill: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: 0.85 }}>
        <MediaFill media={media} style={{ ...fill, transform: "scale(1.25)", filter: `blur(${Math.round(width * 0.012)}px) saturate(1.4)` }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 90% at 78% 50%, rgba(255,46,136,.18), transparent 70%), linear-gradient(90deg, rgba(10,10,14,.92) 0%, rgba(10,10,14,.7) 45%, rgba(10,10,14,.55) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: phone.left,
          top: phone.top,
          width: phone.width,
          height: phone.height,
          borderRadius: Math.round(phone.width * 0.13),
          border: `${bezel}px solid #0B0B10`,
          boxShadow: `0 0 0 ${Math.max(1, Math.round(bezel / 3))}px rgba(255,255,255,.22), 0 ${Math.round(height * 0.03)}px ${Math.round(height * 0.08)}px rgba(0,0,0,.6)`,
          overflow: "hidden",
          backgroundColor: "#000",
          opacity: enter.opacity,
          transform: `translate(${enter.x}%, ${(1 - rise) * 8}%) scale(${zoom})`,
        }}
      >
        <MediaFill media={media} style={fill} />
      </div>
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
  const exit = useExit();
  const rise = spring({ frame, fps, config: { damping: 15, stiffness: 140 } });
  const box = safeBox(width, height, safe);
  const col = textBox(box, phoneBox(box, height));

  if (style === "brand") {
    const icon = Math.round(col.height * 0.3);
    return (
      <Column width={width} height={height} safe={safe}>
        <div style={{ display: "flex", alignItems: "center", gap: icon * 0.3, opacity: rise * exit, transform: `translateY(${(1 - rise) * 30}px)` }}>
          <AppIcon brand={brand} size={icon} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...DISPLAY, color: "#F5F4F8", fontSize: columnFont(brand?.name ?? "", col, 0.2, 4) }}>{brand?.name}</div>
            <div style={{ ...UI, color: "#A9A8B6", fontWeight: 600, fontSize: Math.round(col.height * 0.07), marginTop: col.height * 0.02 }}>
              {text?.trim() || "On the App Store"}
            </div>
          </div>
        </div>
      </Column>
    );
  }

  const hook = style !== "caption";
  const line = text ?? "";
  return (
    <Column width={width} height={height} safe={safe}>
      <div style={{ opacity: exit }}>
        {hook && <div style={{ width: col.width * 0.18, height: Math.max(4, Math.round(col.height * 0.025)), background: PINK, borderRadius: 99, marginBottom: col.height * 0.06, transform: `scaleX(${rise})`, transformOrigin: "left" }} />}
        <Words text={line} style={{ ...DISPLAY, color: hook ? YEL : "#F5F4F8", fontSize: columnFont(line, col, hook ? 0.28 : 0.18, hook ? 6 : 7) }} />
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
