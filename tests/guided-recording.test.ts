import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyseClips } from "@/lib/media/analyse";
import { idleSpans, padRegions, parseFreezes } from "@/lib/media/ffmpeg";
import { liveRange } from "@/lib/schemas/clips";
import { shotCoverage, tidyShots, writeShotList } from "@/lib/shotlist";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { fallbackPreview } from "@/lib/timeline/preview";

const brief = { what_it_does: "Tracks plants", audience: "Plant owners", features: ["Reminders", "Photo ID", "Care tips"], review_phrases: [], tone: "warm" };

describe("shot list", () => {
  it("drops long or empty actions and clamps seconds", () => {
    const out = tidyShots([
      { action: "Open the app on today's plants", seconds: 1 },
      { action: "This action is far too long to read while recording a quick take", seconds: 4 },
      { action: " ", seconds: 3 },
      { action: "Snap a photo of a leaf", seconds: 9 },
    ]);
    expect(out).toEqual([
      { action: "Open the app on today's plants", seconds: 2 },
      { action: "Snap a photo of a leaf", seconds: 6 },
    ]);
  });

  it("asks again when too few shots survive", async () => {
    const prompts: string[] = [];
    const list = await writeShotList(brief, "Plantly", async (prompt) => {
      prompts.push(prompt);
      return prompts.length === 1
        ? { shots: [{ action: "One short shot", seconds: 3 }] }
        : { shots: ["A", "B", "C", "D", "E"].map((x) => ({ action: `Show screen ${x}`, seconds: 3 })) };
    });
    expect(prompts).toHaveLength(2);
    expect(JSON.parse(prompts[1]!).note).toMatch(/10 words/);
    expect(list.shots).toHaveLength(5);
  });

  it("maps clips to shots and spots missing ones", () => {
    const list = { shots: [{ action: "a", seconds: 3 }, { action: "b", seconds: 3 }, { action: "c", seconds: 3 }] };
    const notes = (shot: number | null) => ({ label: "x", interest: 3, personal_info: false, shot });
    const cov = shotCoverage(list, [{ id: "clip_1", notes: notes(1) }, { id: "clip_2", notes: notes(3) }, { id: "clip_3", notes: notes(1) }, { id: "clip_4", notes: null }]);
    expect(cov.map((c) => c.clipIds)).toEqual([["clip_1", "clip_3"], [], ["clip_2"]]);
  });

  it("sends the shot list to the clip check", async () => {
    let prompt = "";
    await analyseClips([{ clipId: "clip_1", frames: [Buffer.from("x")] }], ["Reminders"], async (o) => {
      prompt = o.prompt;
      return { clips: [{ clip_id: "clip_1", label: "x", interest: 3, personal_info: false, shot: 2 }] };
    }, ["Open the app", "Set a reminder"]);
    expect(JSON.parse(prompt).shot_list).toEqual([{ shot: 1, action: "Open the app" }, { shot: 2, action: "Set a reminder" }]);
  });
});

describe("dead time", () => {
  it("reads freezedetect output, including a freeze that runs to the end", () => {
    const log = [
      "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 1.2",
      "[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 2.1",
      "[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 3.3",
      "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 6.5",
    ].join("\n");
    expect(parseFreezes(log, 8)).toEqual([{ start: 1.2, duration: 2.1 }, { start: 6.5, duration: 1.5 }]);
  });

  it("finds a frozen stretch in a real clip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "idle-"));
    const file = join(dir, "c.mp4");
    // 2 s moving, 3 s frozen frame, 2 s moving.
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x640:rate=30:duration=2", "-f", "lavfi", "-i", "color=c=blue:size=320x640:rate=30:duration=3", "-f", "lavfi", "-i", "testsrc2=size=320x640:rate=30:duration=2", "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1[v]", "-map", "[v]", "-pix_fmt", "yuv420p", file]);
    const spans = await idleSpans(file, 7);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.start).toBeCloseTo(2, 0);
    expect(spans[0]!.duration).toBeGreaterThan(2.5);
  });

  it("counts a dim, empty screen as dead time but not a dark screen with content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dim-"));
    const file = join(dir, "d.mp4");
    // 2 s moving, 2 s empty dark-grey screen (with sensor noise, so it isn't frozen), then 2 s of a dark UI
    // with a scrolling white block covering about 8% of the screen, also with noise.
    const dark = "color=c=0x1e1e1e:size=320x640:rate=30:duration=2";
    execFileSync("ffmpeg", [
      "-v", "error",
      "-f", "lavfi", "-i", "testsrc2=size=320x640:rate=30:duration=2",
      "-f", "lavfi", "-i", dark,
      "-f", "lavfi", "-i", dark,
      "-filter_complex",
      "[1:v]noise=alls=6:allf=t[e];color=c=white:size=280x60:rate=30:duration=2[l];[2:v][l]overlay=x=20:y='80+150*t'[o];[o]noise=alls=6:allf=t[u];[0:v][e][u]concat=n=3:v=1[v]",
      "-map", "[v]", "-pix_fmt", "yuv420p", file,
    ]);
    const spans = await idleSpans(file, 6);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.start).toBeCloseTo(2, 0);
    expect(spans[0]!.start + spans[0]!.duration).toBeLessThan(4.3);
  });

  it("keeps the longest live stretch of a clip", () => {
    expect(liveRange({ duration: 10, idle: [{ start: 0, duration: 2 }, { start: 7, duration: 3 }] })).toEqual({ offset: 2, duration: 5 });
    expect(liveRange({ duration: 6 })).toEqual({ offset: 0, duration: 6 });
    expect(liveRange({ duration: 1.5, idle: [{ start: 0.2, duration: 1.2 }] })).toEqual({ offset: 0, duration: 1.5 });
  });

  it("skips dead time in the fallback cut when there's enough footage", () => {
    const notes = { label: "x", interest: 4, personal_info: false };
    const clips = [
      { id: "clip_1", duration: 12, notes, idle: [{ start: 0, duration: 3 }] },
      { id: "clip_2", duration: 12, notes },
    ];
    const t = fallbackPreview(clips, null, OUTPUT_SPECS.preview);
    const first = t.segments.find((s) => s.clip_id === "clip_1")!;
    expect(first.clip_offset).toBe(3);
    expect(first.duration).toBe(9);
    expect(enforceSpec(t, OUTPUT_SPECS.preview, { clip_1: 12, clip_2: 12 })).toEqual([]);
  });
});

describe("blur boxes", () => {
  it("pads boxes and snaps them to nearby edges", () => {
    const [r] = padRegions([{ x: 0.1, y: 0.5, w: 0.5, h: 0.33 }]);
    expect(r!.x).toBe(0);
    expect(r!.y).toBeCloseTo(0.47);
    expect(r!.y + r!.h).toBe(1);
    expect(r!.x + r!.w).toBeCloseTo(0.63);
  });
});

describe("draft quality fixes", () => {
  it("keeps a short lead-in like POV: with the line after it", async () => {
    const { shortLine } = await import("@/lib/timeline/preview");
    expect(shortLine("POV: you finally know when to water")).toBe("POV: you finally know when to water");
    expect(shortLine("Stop guessing. Start growing.")).toBe("Stop guessing");
    expect(shortLine("Your plants, sorted: no more guessing")).toBe("Your plants, sorted");
  });

  it("reads black stretches and merges them with frozen ones", async () => {
    const { parseBlacks, mergeSpans } = await import("@/lib/media/ffmpeg");
    const blacks = parseBlacks("[blackdetect @ 0x1] black_start:0 black_end:1.4 black_duration:1.4\n");
    expect(blacks).toEqual([{ start: 0, duration: 1.4 }]);
    expect(mergeSpans([...blacks, { start: 1.2, duration: 1.3 }, { start: 5, duration: 1 }])).toEqual([
      { start: 0, duration: 2.5 },
      { start: 5, duration: 1 },
    ]);
  });

  it("moves a shot that opens on dead time to the live part of the clip", async () => {
    const { avoidDeadTime } = await import("@/lib/timeline/dead-time");
    const clips = [
      { id: "clip_1", duration: 8, idle: [{ start: 0, duration: 2 }] },
      { id: "clip_2", duration: 4, idle: [{ start: 0, duration: 2 }] },
    ];
    const t = avoidDeadTime(
      {
        segments: [
          { type: "screen", start: 0, duration: 5, clip_id: "clip_1" },
          { type: "screen", start: 5, duration: 4, clip_id: "clip_2" },
        ],
      },
      clips,
    );
    expect(t.segments[0]!.clip_offset).toBe(2);
    // No room to shift: left as planned.
    expect(t.segments[1]!.clip_offset).toBeUndefined();
  });

  it("moves a segment that runs into dead time onto live footage", async () => {
    const { avoidDeadTime } = await import("@/lib/timeline/dead-time");
    // Clip 2 of a real pack: dark, empty canvas at 1.73-6.2 s and 7.23-11.43 s.
    const clips = [{ id: "clip_2", duration: 12, idle: [{ start: 1.73, duration: 4.47 }, { start: 7.23, duration: 4.2 }] }];
    const t = avoidDeadTime(
      {
        segments: [
          { type: "screen", start: 0, duration: 2.4, clip_id: "clip_2", clip_offset: 6.2 },
          { type: "screen", start: 2.4, duration: 1.5, clip_id: "clip_2", clip_offset: 0 },
          { type: "screen", start: 3.9, duration: 1, clip_id: "clip_2", clip_offset: 6.2 },
        ],
      },
      clips,
    );
    // 2.4 s fits in no live stretch, so it takes the window with the least dead time: 0-2.4 s (0.67 s dead,
    // against 1.4 s as planned).
    expect(t.segments[0]!.clip_offset).toBe(0);
    // Already live: left alone.
    expect(t.segments[1]!.clip_offset).toBe(0);
    expect(t.segments[2]!.clip_offset).toBe(6.2);
  });
});

describe("blurred clips", () => {
  it("measures blur by the union of the boxes", async () => {
    const { coveredShare } = await import("@/lib/media/ffmpeg");
    expect(coveredShare([])).toBe(0);
    expect(coveredShare([{ x: 0, y: 0, w: 1, h: 0.5 }])).toBeCloseTo(0.5, 2);
    // Two overlapping boxes count once.
    expect(coveredShare([{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.25, w: 1, h: 0.5 }])).toBeCloseTo(0.75, 2);
  });

  it("treats a clip blurred over most of the frame like a private one", async () => {
    const { isPrivate } = await import("@/lib/schemas/clips");
    const base = { label: "Chat", interest: 3, personal_info: true };
    expect(isPrivate({ ...base })).toBe(true);
    expect(isPrivate({ ...base, blurred: true, blur_share: 0.2 })).toBe(false);
    expect(isPrivate({ ...base, blurred: true, blur_share: 0.9 })).toBe(true);
    expect(isPrivate({ ...base, personal_info: false })).toBe(false);
  });

  it("plans on screenshots when every clip is blurred over", async () => {
    const { safeClips } = await import("@/lib/timeline/plan");
    const notes = { label: "Chat", interest: 3, personal_info: true, blurred: true, blur_share: 0.9 };
    const clips = [
      { id: "clip_1", duration: 6, notes },
      { id: "clip_2", duration: 6, notes: { ...notes, blur_share: 0.3 } },
    ];
    expect(safeClips(clips, { minSeconds: 15 }, 15).map((c) => c.id)).toEqual(["clip_2"]);
  });
});
