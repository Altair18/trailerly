import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { isOverlay } from "@/lib/timeline/enforce";
import type { Segment, Timeline } from "@/lib/timeline/schema";
import { useBrandFonts } from "../fonts";

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
}

const INK = "#0A0A0E";
const DISPLAY = { fontFamily: "Archivo, sans-serif", fontStretch: "72%", fontWeight: 900, lineHeight: 0.92 } as const;

export function TimelineVideo({ timeline, clipUrls, watermark, baseWidth, baseHeight }: TimelineVideoProps) {
  useBrandFonts();
  const { fps, width } = useVideoConfig();
  const scale = width / baseWidth;
  const base = timeline.segments.filter((s) => !isOverlay(s));
  const overlays = timeline.segments.filter(isOverlay);

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: baseWidth, height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {base.map((seg, i) => (
          <Sequence key={`b${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            <SegmentView segment={seg} clipUrls={clipUrls} />
          </Sequence>
        ))}
        {overlays.map((seg, i) => (
          <Sequence key={`o${i}`} from={Math.round(seg.start * fps)} durationInFrames={Math.max(1, Math.round(seg.duration * fps))}>
            <TextOverlay text={seg.text ?? ""} width={baseWidth} />
          </Sequence>
        ))}
        {/* TODO(M3): device frame for header/search, 0.5 s loop crossfade. TODO(M5): captions + end card. */}
        {watermark && <Watermark width={baseWidth} />}
      </div>
    </AbsoluteFill>
  );
}

function SegmentView({ segment, clipUrls }: { segment: Segment; clipUrls: Record<string, string> }) {
  const { fps } = useVideoConfig();
  const src = segment.clip_id ? clipUrls[segment.clip_id] : undefined;
  if (segment.type === "screen" && src) {
    return (
      <AbsoluteFill>
        <OffthreadVideo
          src={src}
          muted
          trimBefore={Math.round((segment.clip_offset ?? 0) * fps)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    );
  }
  if (segment.type === "text" || segment.type === "end_card") {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "10%", backgroundColor: "#FFE135" }}>
        <div style={{ ...DISPLAY, color: INK, fontSize: 140, textAlign: "center" }}>{segment.text}</div>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ backgroundColor: "#18181F" }} />;
}

/** Headline over the screen: a bright chip near the top, eased in. */
function TextOverlay({ text, width }: { text: string; width: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, Math.round(fps * 0.35)], [0, 1], { extrapolateRight: "clamp" });
  const pad = Math.round(width * 0.06);
  return (
    <AbsoluteFill style={{ padding: pad, paddingTop: pad * 2, alignItems: "flex-start" }}>
      <div
        style={{
          ...DISPLAY,
          fontSize: Math.round(width * 0.115),
          color: INK,
          backgroundColor: "#FFE135",
          padding: `${pad * 0.35}px ${pad * 0.5}px`,
          borderRadius: pad * 0.4,
          maxWidth: "100%",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
          boxShadow: "0 30px 60px rgba(0,0,0,.45)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

function Watermark({ width }: { width: number }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ ...DISPLAY, color: "rgba(255,255,255,0.28)", fontSize: Math.round(width * 0.16), transform: "rotate(-30deg)", whiteSpace: "nowrap" }}>
        TRAILERLY DRAFT
      </div>
    </AbsoluteFill>
  );
}
