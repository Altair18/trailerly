import { describe, expect, it } from "vitest";
import { soundtrackFor } from "@/lib/media/music";
import { nearestBeat, snapCutsToBeats } from "@/lib/timeline/beats";
import type { Timeline } from "@/lib/timeline/schema";

const grid = { bpm: 120, beat0: 0.1 }; // beats at 0.1, 0.6, 1.1, ...

const timeline: Timeline = {
  segments: [
    { type: "screen", clip_id: "a", start: 0, duration: 3.2 },
    { type: "screen", clip_id: "b", start: 3.2, duration: 5 },
    { type: "screen", clip_id: "c", start: 8.2, duration: 5 },
    { type: "text", overlay: true, style: "hook", start: 0, duration: 3.2, text: "Never forget to water again" },
    { type: "text", overlay: true, style: "caption", start: 3.2, duration: 5, text: "Know when they're thirsty" },
    { type: "text", overlay: true, style: "brand", start: 8.2, duration: 5, text: "Happy plants" },
  ],
};

describe("cutting on the beat", () => {
  it("finds the nearest beat", () => {
    expect(nearestBeat(3.2, grid)).toBeCloseTo(3.1);
    expect(nearestBeat(3.4, grid)).toBeCloseTo(3.6);
  });

  it("moves each cut to its nearest beat, with the text, keeping the total", () => {
    const t = snapCutsToBeats(timeline, grid);
    const base = t.segments.filter((s) => !s.overlay);
    expect(base.map((s) => s.start)).toEqual([0, 3.1, 8.1]);
    expect(base[2]!.start + base[2]!.duration).toBeCloseTo(13.2);
    const text = t.segments.filter((s) => s.overlay);
    expect(text.map((s) => [s.start, s.duration])).toEqual([[0, 3.1], [3.1, 5], [8.1, 5.1]]);
  });

  it("leaves a cut alone when the beat is too far, near the poster frame, or a clip would run out", () => {
    expect(snapCutsToBeats(timeline, { bpm: 60, beat0: 0.7 }).segments[1]!.start).toBe(3.2);
    const nearPoster: Timeline = { segments: [{ type: "screen", clip_id: "a", start: 0, duration: 4.8 }, { type: "screen", clip_id: "b", start: 4.8, duration: 5 }] };
    expect(snapCutsToBeats(nearPoster, { bpm: 120, beat0: 0 }, { avoid: { at: 5, clear: 0.5 } }).segments[1]!.start).toBe(4.8);
    const late = snapCutsToBeats(timeline, { bpm: 120, beat0: 0.3 }, { clipSeconds: { a: 3.2, b: 10, c: 10 } });
    expect(late.segments[1]!.start).toBe(3.2);
  });

  it("carries the bed's beat grid in the soundtrack", () => {
    const manifest = { beds: [{ id: "x", file: "music/x.mp3", moods: ["calm"], bpm: 100, beat0: 0.2 }], effects: [] };
    expect(soundtrackFor(manifest, "Lifestyle", "p").beats).toEqual({ bpm: 100, beat0: 0.2 });
  });
});
