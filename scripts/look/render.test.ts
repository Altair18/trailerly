import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { it } from "vitest";
import { renderOutput } from "@/lib/render";
import { iconAccent } from "@/lib/media/accent";
import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { avoidDeadTime } from "@/lib/timeline/dead-time";
import { buildFromTemplate, templateById, type TemplateFill } from "@/lib/timeline/templates";

const D = process.env.DEMO_DIR!;
const SCALE = Number(process.env.SCALE ?? 0.5);
const ONLY = process.env.ONLY?.split(",");
const raw = JSON.parse(readFileSync(join(D, "clips.json"), "utf8"));
const NOTES: Record<string, { label: string; interest: number; feature: string }> = {
  clip_1: { label: "Ticks off today's waterings", interest: 4, feature: "Watering reminders" },
  clip_2: { label: "Identifies a plant from the camera", interest: 5, feature: "Plant ID" },
  clip_3: { label: "Streak and progress chart", interest: 4, feature: "Progress" },
};
const clips = raw.map((c: { id: string }) => ({ ...c, notes: { ...NOTES[c.id], personal_info: false } }));
const hook = "Never forget to water again";
const PLANS: { spec: OutputSpecId; fill: TemplateFill }[] = [
  { spec: "header", fill: { template_id: "calm-loop", beats: [{ source: "clip_1", offset: 1.6 }, { source: "clip_2", offset: 3, caption: "Snap a leaf to name any plant" }, { source: "clip_1", offset: 0 }] } },
  { spec: "search", fill: { template_id: "two-beat", beats: [{ source: "clip_2", offset: 2 }, { source: "clip_1", offset: 1.6, caption: "Tick off today's waterings" }, { source: "clip_3", offset: 0, caption: "Build a care streak" }, { source: "clip_1", offset: 0 }] } },
];

it("renders header and search", async () => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", req.url!.endsWith(".png") ? "image/png" : "video/mp4");
    createReadStream(D + req.url).pipe(res);
  }).listen(4557);
  for (const { spec: id, fill } of PLANS) {
    if (ONLY && !ONLY.includes(id)) continue;
    const spec = OUTPUT_SPECS[id];
    const built = buildFromTemplate(templateById(fill.template_id)!, fill, spec, { hook, clips });
    if (!built.timeline) throw new Error(built.errors.join("\n"));
    const timeline = avoidDeadTime(built.timeline, clips);
    writeFileSync(join(D, `${id}.json`), JSON.stringify(timeline, null, 1));
    await renderOutput({
      spec: id,
      outFile: join(D, `${id}.mp4`),
      props: {
        timeline,
        clipUrls: Object.fromEntries(clips.map((c: { id: string }) => [c.id, `http://localhost:4557/${c.id}.mp4`])),
        watermark: false,
        loop: spec.loop,
        baseWidth: spec.width,
        baseHeight: spec.height,
        safeArea: spec.safeArea,
        brand: { name: "Sprout", iconUrl: "http://localhost:4557/icon.png", accent: await iconAccent(join(D, "icon.png")) },
        scale: SCALE,
        clipFocus: Object.fromEntries(clips.map((c: { id: string; focus?: unknown }) => [c.id, c.focus ?? []])),
      },
    });
  }
  server.close();
});
