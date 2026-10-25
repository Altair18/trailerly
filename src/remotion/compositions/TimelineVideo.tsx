import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import type { Segment, Timeline } from "@/lib/timeline/schema";

export interface TimelineVideoProps extends Record<string, unknown> {
  timeline: Timeline;
  /** clip_id or scene id -> URL of the prepared clip. */
  clipUrls: Record<string, string>;
  watermark: boolean;
  /** Header only: crossfade last frame to first for a seamless loop. */
  loop: boolean;
}

export function TimelineVideo({ timeline, clipUrls, watermark }: TimelineVideoProps) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f" }}>
      {timeline.segments.map((seg, i) => (
        <Sequence
          key={i}
          from={Math.round(seg.start * fps)}
          durationInFrames={Math.round(seg.duration * fps)}
        >
          <SegmentView segment={seg} clipUrls={clipUrls} />
        </Sequence>
      ))}
      {/* TODO(M2): device frame for screens; TODO(M3): 0.5s loop crossfade; TODO(M5): captions + end card. */}
      {watermark && <Watermark />}
    </AbsoluteFill>
  );
}

function SegmentView({ segment, clipUrls }: { segment: Segment; clipUrls: Record<string, string> }) {
  const src = segment.clip_id ? clipUrls[segment.clip_id] : undefined;
  if ((segment.type === "screen" || segment.type === "ai_scene") && src) {
    return <OffthreadVideo src={src} muted />;
  }
  if (segment.type === "text" || segment.type === "end_card") {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "8%" }}>
        <div style={{ color: "white", fontSize: 96, fontWeight: 800, textAlign: "center", fontFamily: "sans-serif" }}>
          {segment.text}
        </div>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ backgroundColor: "#22222a" }} />;
}

function Watermark() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 140, fontWeight: 900, transform: "rotate(-30deg)", fontFamily: "sans-serif" }}>
        TRAILERLY DRAFT
      </div>
    </AbsoluteFill>
  );
}
