import type { OutputSpec } from "@/lib/specs/outputs";
import type { Timeline } from "./schema";

/**
 * Code-side checks on a model-planned timeline (pipeline stage 5).
 * Returns a list of human-readable errors to feed back to the model; empty means OK.
 */
export function enforceSpec(timeline: Timeline, spec: OutputSpec): string[] {
  const errors: string[] = [];
  const segs = timeline.segments;

  const total = Math.max(...segs.map((s) => s.start + s.duration));
  if (total < spec.minSeconds || total > spec.maxSeconds) {
    errors.push(`Total length ${total}s is outside ${spec.minSeconds} to ${spec.maxSeconds}s.`);
  }

  for (const s of segs) {
    if (!spec.allowedSegments.includes(s.type)) {
      errors.push(`Segment type "${s.type}" is not allowed in ${spec.label}.`);
    }
    if (s.type === "screen" && !s.clip_id) errors.push(`Screen segment at ${s.start}s has no clip_id.`);
    if (s.type === "ai_scene" && !s.prompt) errors.push(`AI scene at ${s.start}s has no prompt.`);
  }

  const aiSeconds = sumSeconds(timeline, "ai_scene");
  if (aiSeconds > spec.maxAiSeconds) {
    errors.push(`AI scenes total ${aiSeconds}s; the cap is ${spec.maxAiSeconds}s.`);
  }

  if (spec.minScreenShare > 0 && total > 0) {
    const share = sumSeconds(timeline, "screen") / total;
    if (share < spec.minScreenShare) {
      errors.push(
        `Real screens are ${Math.round(share * 100)}% of the time; at least ${spec.minScreenShare * 100}% is required.`,
      );
    }
  }

  return errors;
}

export function sumSeconds(timeline: Timeline, type: Timeline["segments"][number]["type"]): number {
  return timeline.segments.filter((s) => s.type === type).reduce((n, s) => n + s.duration, 0);
}
