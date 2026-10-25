import { describe, expect, it } from "vitest";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import { enforceSpec } from "@/lib/timeline/enforce";
import { buildFromTemplate, TEMPLATES, templateById, templatePrompt, templatesFor, tidyCaption } from "@/lib/timeline/templates";

const clips = [
  { id: "clip_1", duration: 6, notes: { label: "Home", interest: 3, personal_info: false } },
  { id: "clip_2", duration: 9, notes: { label: "Scan", interest: 5, personal_info: false } },
  { id: "clip_3", duration: 8, notes: { label: "Plan", interest: 4, personal_info: false } },
  { id: "clip_4", duration: 7, notes: { label: "Chat", interest: 4, personal_info: false } },
];
const clipSeconds = Object.fromEntries(clips.map((c) => [c.id, c.duration]));
const screenshots = [{ id: "shot_1" }, { id: "shot_2" }, { id: "shot_3" }, { id: "shot_4" }];

/** A fill that uses the clips in turn (screenshots when the spec has no footage). */
function autoFill(templateId: string, withClips = true) {
  const t = templateById(templateId)!;
  return {
    template_id: t.id,
    beats: t.beats.map((b, i) => ({
      source: withClips ? clips[i % clips.length]!.id : screenshots[i % screenshots.length]!.id,
      caption: b.caption ? `Feature number ${i} shown here` : undefined,
    })),
    cta: "Download free today",
  };
}

describe("cut templates", () => {
  it("offers several templates for each shape, and skips ones a sibling used", () => {
    expect(templatesFor(OUTPUT_SPECS.preview).length).toBeGreaterThanOrEqual(5);
    expect(templatesFor(OUTPUT_SPECS.header).length).toBeGreaterThanOrEqual(3);
    expect(templatesFor(OUTPUT_SPECS.search, ["single-hero"]).map((t) => t.id)).not.toContain("single-hero");
    // Never runs out: with everything avoided, all come back.
    const all = templatesFor(OUTPUT_SPECS.header).map((t) => t.id);
    expect(templatesFor(OUTPUT_SPECS.header, all).length).toBe(all.length);
  });

  it("every template builds a timeline that passes its specs, from clips and from screenshots only", () => {
    for (const t of TEMPLATES) {
      const specs = t.shape === "landscape" ? [OUTPUT_SPECS.header, OUTPUT_SPECS.search] : [OUTPUT_SPECS.preview, OUTPUT_SPECS.social_1];
      for (const spec of specs) {
        for (const withClips of [true, false]) {
          const built = buildFromTemplate(t, autoFill(t.id, withClips), spec, { hook: "Stop guessing when to water", clips, screenshots });
          expect(built.errors, `${t.id} on ${spec.id}`).toEqual([]);
          expect(enforceSpec(built.timeline!, spec, clipSeconds, screenshots.map((s) => s.id)), `${t.id} on ${spec.id}`).toEqual([]);
          expect(built.timeline!.template).toBe(t.id);
        }
      }
    }
  });

  it("ends social ads on the call-to-action card and App Store videos on the brand line", () => {
    const social = buildFromTemplate(templateById("rapid-list")!, autoFill("rapid-list"), OUTPUT_SPECS.social_1, { hook: "POV: plants that thrive", clips });
    expect(social.timeline!.segments.find((s) => s.type === "end_card")?.text).toBe("Download free today");
    const preview = buildFromTemplate(templateById("rapid-list")!, autoFill("rapid-list"), OUTPUT_SPECS.preview, { hook: "Plants that thrive", clips });
    expect(preview.timeline!.segments.some((s) => s.type === "end_card")).toBe(false);
    expect(preview.timeline!.segments.some((s) => s.style === "brand")).toBe(true);
  });

  it("tells the model what to fix instead of building a bad plan", () => {
    const t = templateById("hero-deep")!;
    const fill = autoFill("hero-deep");
    fill.beats[1] = { source: "clip_9", caption: "x" };
    expect(buildFromTemplate(t, fill, OUTPUT_SPECS.preview, { hook: "Hi there", clips }).errors.join(" ")).toMatch(/unknown clip or screenshot "clip_9"/);
    const short = { ...autoFill("hero-deep"), beats: autoFill("hero-deep").beats.map((b) => ({ ...b, source: "clip_1", offset: 5 })) };
    expect(buildFromTemplate(t, short, OUTPUT_SPECS.preview, { hook: "Hi there", clips }).errors.join(" ")).toMatch(/clip_1 has only/);
  });

  it("uses the first caption as the hook when no hook was chosen", () => {
    const t = templateById("two-beat")!;
    const fill = autoFill("two-beat");
    fill.beats[0] = { source: "clip_2", caption: "Your garden, on autopilot" };
    const built = buildFromTemplate(t, fill, OUTPUT_SPECS.header, { hook: null, clips });
    expect(built.timeline!.segments.find((s) => s.style === "hook")?.text).toBe("Your garden, on autopilot");
  });

  it("trims captions to on-screen limits", () => {
    expect(tidyCaption("Snap a photo of any leaf and get a diagnosis in seconds")).toBe("Snap a photo of any leaf");
    expect(tidyCaption("POV: your plants finally thrive")).toBe("POV: your plants finally thrive");
  });

  it("sends the model the templates, the media and the fixed hook", () => {
    const prompt = JSON.parse(
      templatePrompt(OUTPUT_SPECS.header, { hook: "Hi", clips, screenshots: [], brief: { features: ["a"], tone: "Warm" } }, templatesFor(OUTPUT_SPECS.header), ""),
    );
    expect(prompt.hook).toBe("Hi");
    expect(prompt.templates.map((t: { id: string }) => t.id)).toContain("calm-loop");
    expect(prompt.clips[0]).toMatchObject({ clip_id: "clip_1", seconds: 6 });
  });
});
