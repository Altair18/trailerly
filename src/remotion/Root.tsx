import { Composition } from "remotion";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { totalSeconds } from "@/lib/timeline/enforce";
import { TimelineVideo, type TimelineVideoProps } from "./compositions/TimelineVideo";

export interface RenderProps extends TimelineVideoProps {
  /** 1 for finals, DRAFT_SCALE for drafts. */
  scale: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Remotion composition ids can't contain underscores. */
export const compositionId = (spec: string) => spec.replace(/_/g, "-");

// One composition per output spec; all read the same timeline JSON.
export function RemotionRoot() {
  return (
    <>
      {Object.values(OUTPUT_SPECS).map((spec) => (
        <Composition
          key={spec.id}
          id={compositionId(spec.id)}
          component={TimelineVideo}
          width={spec.width}
          height={spec.height}
          fps={spec.fps}
          durationInFrames={spec.minSeconds * spec.fps}
          defaultProps={
            {
              timeline: {
                segments: [
                  { type: "text", start: 0, duration: spec.minSeconds, text: "Your hook goes here" },
                ],
              },
              clipUrls: {},
              imageUrls: {},
              watermark: true,
              loop: spec.loop,
              baseWidth: spec.width,
              baseHeight: spec.height,
              brand: { name: "Your App", iconUrl: null },
              scale: 1,
            } satisfies RenderProps
          }
          calculateMetadata={({ props }) => ({
            durationInFrames: Math.round(totalSeconds(props.timeline) * spec.fps),
            width: even(spec.width * (props as RenderProps).scale),
            height: even(spec.height * (props as RenderProps).scale),
          })}
        />
      ))}
    </>
  );
}
