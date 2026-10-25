import { Composition } from "remotion";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { TimelineVideo, type TimelineVideoProps } from "./compositions/TimelineVideo";

const sample: TimelineVideoProps = {
  timeline: {
    segments: [
      { type: "text", start: 0, duration: 3, text: "Your hook goes here" },
      { type: "screen", start: 3, duration: 12, clip_id: "clip_1" },
    ],
  },
  clipUrls: {},
  watermark: true,
  loop: false,
};

// One composition per output spec; all read the same timeline JSON.
export function RemotionRoot() {
  return (
    <>
      {Object.values(OUTPUT_SPECS).map((spec) => (
        <Composition
          key={spec.id}
          id={spec.id}
          component={TimelineVideo}
          width={spec.width}
          height={spec.height}
          fps={spec.fps}
          durationInFrames={spec.minSeconds * spec.fps}
          defaultProps={{ ...sample, loop: spec.loop }}
          calculateMetadata={({ props }) => {
            const seconds = Math.max(...props.timeline.segments.map((s) => s.start + s.duration));
            return { durationInFrames: Math.round(seconds * spec.fps) };
          }}
        />
      ))}
    </>
  );
}
