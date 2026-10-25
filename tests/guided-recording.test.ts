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
