import type { OutputSpec } from "@/lib/specs/outputs";
import type { Segment, Timeline } from "./schema";

const EPS = 0.05;

/** On-screen text limits: short enough to read on a phone in one glance. */
export const MAX_OVERLAY_WORDS = 7;
export const MAX_OVERLAY_CHARS = 42;
export const MAX_CARD_WORDS = 9;
/** Reading time: 0.3 s per word, never under 1.2 s. */
export const readSeconds = (text: string) => Math.max(1.2, 0.3 * wordCount(text));
export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const isOverlay = (s: Segment) => s.type === "text" && s.overlay === true;
export const totalSeconds = (timeline: Timeline) => Math.max(...timeline.segments.map((s) => s.start + s.duration));

/**
 * Code-side checks on a model-planned timeline (pipeline stage 5).
 * Returns a list of human-readable errors to feed back to the model; empty means OK.
 * Pass `clipSeconds` (clip id -> length) to also check screen segments fit their clips.
 */
export function enforceSpec(timeline: Timeline, spec: OutputSpec, clipSeconds?: Record<string, number>): string[] {
  const errors: string[] = [];
  const segs = timeline.segments;

  const total = totalSeconds(timeline);
  if (total < spec.minSeconds || total > spec.maxSeconds) {
    errors.push(`Total length ${round(total)}s is outside ${spec.minSeconds} to ${spec.maxSeconds}s.`);
  }

  for (const s of segs) {
    if (!spec.allowedSegments.includes(s.type)) {
      errors.push(`Segment type "${s.type}" is not allowed in ${spec.label}.`);
    }
    if (s.type === "screen" && !s.clip_id) errors.push(`Screen segment at ${s.start}s has no clip_id.`);
    if (s.type === "ai_scene" && !s.prompt) errors.push(`AI scene at ${s.start}s has no prompt.`);
    if ((s.type === "text" || s.type === "end_card") && !s.text?.trim() && s.style !== "brand") {
      errors.push(`Text at ${s.start}s is empty.`);
    }
    if (s.text?.trim()) {
      const words = wordCount(s.text);
      const where = `Text "${s.text}" at ${s.start}s`;
      if (isOverlay(s) && (words > MAX_OVERLAY_WORDS || s.text.trim().length > MAX_OVERLAY_CHARS)) {
        errors.push(`${where} is too long for on-screen text: use at most ${MAX_OVERLAY_WORDS} words and ${MAX_OVERLAY_CHARS} characters.`);
      } else if (!isOverlay(s) && words > MAX_CARD_WORDS) {
        errors.push(`${where} is too long: use at most ${MAX_CARD_WORDS} words.`);
      }
      if (s.duration + EPS < readSeconds(s.text)) {
        errors.push(`${where} is on screen for ${round(s.duration)}s; it needs at least ${round(readSeconds(s.text))}s to read.`);
      }
    }
    if (s.type === "screen" && s.clip_id && clipSeconds) {
      const len = clipSeconds[s.clip_id];
      if (len === undefined) errors.push(`Unknown clip "${s.clip_id}" at ${s.start}s.`);
      else if ((s.clip_offset ?? 0) + s.duration > len + EPS) {
        errors.push(`Screen segment at ${s.start}s runs past the end of ${s.clip_id} (${len}s long).`);
      }
    }
  }

  // Base layer (everything except overlays) must play back to back with no gaps or overlaps.
  const base = segs.filter((s) => !isOverlay(s)).sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const s of base) {
    if (Math.abs(s.start - cursor) > EPS) {
      errors.push(s.start > cursor ? `Gap from ${round(cursor)}s to ${round(s.start)}s.` : `Segments overlap at ${round(s.start)}s.`);
    }
    cursor = s.start + s.duration;
  }

  // Overlays: one at a time, and inside the video.
  const overlays = segs.filter(isOverlay).sort((a, b) => a.start - b.start);
  for (let i = 1; i < overlays.length; i++) {
    const prev = overlays[i - 1]!;
    if (overlays[i]!.start < prev.start + prev.duration - EPS) {
      errors.push(`Text overlays overlap at ${round(overlays[i]!.start)}s; show one line at a time.`);
    }
  }
  const baseEnd = cursor;
  for (const o of overlays) {
    if (o.start + o.duration > baseEnd + EPS) errors.push(`Text overlay at ${round(o.start)}s runs past the end of the video.`);
  }

  const aiSeconds = sumSeconds(timeline, "ai_scene");
  if (aiSeconds > spec.maxAiSeconds) {
    errors.push(`AI scenes total ${round(aiSeconds)}s; the cap is ${spec.maxAiSeconds}s.`);
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

export function sumSeconds(timeline: Timeline, type: Segment["type"]): number {
  return timeline.segments.filter((s) => s.type === type && !isOverlay(s)).reduce((n, s) => n + s.duration, 0);
}

const round = (n: number) => Math.round(n * 10) / 10;
