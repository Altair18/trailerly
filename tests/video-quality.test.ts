import { describe, expect, it } from "vitest";
import { analyseClips, rankClips } from "@/lib/media/analyse";
import { chromeCrop } from "@/lib/media/ffmpeg";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec, readSeconds } from "@/lib/timeline/enforce";
import { fallbackPreview, shortLine } from "@/lib/timeline/preview";

const notes = (interest: number, personal_info = false) => ({ label: "x", interest, personal_info });

describe("chromeCrop", () => {
  it("cuts the status and gesture bars from portrait recordings", () => {
    expect(chromeCrop(1080, 2400)).toBe("crop=1080:2184:0:132");
  });
  it("leaves landscape alone", () => {
    expect(chromeCrop(1920, 1080)).toBeNull();
  });
});

describe("on-screen text rules", () => {
  const screen = { type: "screen" as const, start: 0, duration: 20, clip_id: "c1" };
  it("rejects long overlays and asks for a shorter line", () => {
    const errors = enforceSpec(
      { segments: [screen, { type: "text", overlay: true, style: "caption", start: 0, duration: 4, text: "Research with citations. Analyze photos, PDFs and more" }] },
      OUTPUT_SPECS.preview,
    );
    expect(errors.join(" ")).toMatch(/too long for on-screen text/);
  });
  it("rejects overlapping and too-quick lines", () => {
    const errors = enforceSpec(
      {
        segments: [
          screen,
          { type: "text", overlay: true, start: 0, duration: 3, text: "Ask anything" },
          { type: "text", overlay: true, start: 2, duration: 0.8, text: "Get answers fast" },
        ],
      },
      OUTPUT_SPECS.preview,
    );
    expect(errors.join(" ")).toMatch(/overlap at 2s/);
    expect(errors.join(" ")).toMatch(/needs at least 1.2s/);
  });
  it("accepts a brand overlay with no text", () => {
    expect(enforceSpec({ segments: [screen, { type: "text", overlay: true, style: "brand", start: 17, duration: 3 }] }, OUTPUT_SPECS.preview)).toEqual([]);
  });
  it("reading time grows with words", () => {
    expect(readSeconds("Hi")).toBe(1.2);
    expect(readSeconds("one two three four five six seven")).toBeCloseTo(2.1);
  });
});

describe("shortLine", () => {
  it("keeps the first clause and caps the words", () => {
    expect(shortLine("Stuck on a bug for hours? Claude finds it in seconds")).toBe("Stuck on a bug for hours");
    expect(shortLine("one two three four five six seven eight nine")).toBe("one two three four five six seven");
  });
});

describe("clip ranking and fallback", () => {
  const clips = [
    { id: "clip_1", duration: 8, notes: notes(2) },
    { id: "clip_2", duration: 8, notes: notes(5, true) },
    { id: "clip_3", duration: 8, notes: notes(5) },
    { id: "clip_4", duration: 8, notes: notes(3) },
  ];
  it("puts the best clean clips first and personal data last", () => {
    expect(rankClips(clips).map((c) => c.id)).toEqual(["clip_3", "clip_4", "clip_1", "clip_2"]);
  });
  it("leaves out clips with personal data when there's enough without them", () => {
    const t = fallbackPreview(clips, "Stuck on a bug for hours? Claude finds it", OUTPUT_SPECS.preview);
    expect(t.segments.some((s) => s.clip_id === "clip_2")).toBe(false);
    expect(t.segments.find((s) => s.style === "hook")?.text).toBe("Stuck on a bug for hours?");
    expect(t.segments.some((s) => s.style === "brand")).toBe(true);
    expect(enforceSpec(t, OUTPUT_SPECS.preview, Object.fromEntries(clips.map((c) => [c.id, c.duration])))).toEqual([]);
  });
});

describe("analyseClips", () => {
  it("sends labelled frames and maps the reply by clip id", async () => {
    let imageCount = 0;
    const result = await analyseClips(
      [
        { clipId: "clip_1", frames: [Buffer.from("a"), Buffer.from("b")] },
        { clipId: "clip_2", frames: [Buffer.from("c")] },
      ],
      ["Chat"],
      async ({ images }) => {
        imageCount = images.length;
        return { clips: [{ clip_id: "clip_1", label: "Opens chat", interest: 4, personal_info: true, privacy_note: "chat titles" }] };
      },
    );
    expect(imageCount).toBe(3);
    expect(result.clip_1).toMatchObject({ label: "Opens chat", personal_info: true });
  });
});
