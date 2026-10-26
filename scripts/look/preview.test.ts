import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { it } from "vitest";
import { renderOutput } from "@/lib/render";
import { iconAccent } from "@/lib/media/accent";
import type { Look } from "@/remotion/compositions/Landscape";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import type { Segment, Timeline } from "@/lib/timeline/schema";

// Renders the App Store preview in each look, from store screenshots and from the demo recording.
const D = process.env.DEMO_DIR!;
const SCALE = Number(process.env.SCALE ?? 0.5);
const LOOKS = (process.env.LOOKS ?? "studio,cinematic,bold").split(",") as Look[];
const WATERMARK = process.env.WATERMARK === "1";

const caption = (start: number, duration: number, text: string): Segment => ({ type: "text", start, duration, text, overlay: true, style: "caption" });
// Like a screenshot-only pack: store screenshots (each with its own headline), a hook, and the brand over the last one.
const shots: Timeline = {
  segments: [
    { type: "screenshot", image_id: "shot_4", start: 0, duration: 3.5 },
    { type: "screenshot", image_id: "shot_1", start: 3.5, duration: 3.5 },
    { type: "screenshot", image_id: "shot_2", start: 7, duration: 3.5 },
    { type: "screenshot", image_id: "shot_3", start: 10.5, duration: 3.5 },
    { type: "screenshot", image_id: "shot_1", start: 14, duration: 3 },
    { type: "text", start: 0, duration: 3.5, text: "Never forget to water again", overlay: true, style: "hook" },
    caption(3.5, 3.5, "Reminders that fit your week"),
    caption(7, 3.5, "Snap a leaf to name it"),
    caption(10.5, 3.5, "Build a care streak"),
    { type: "text", start: 14, duration: 3, overlay: true, style: "brand" },
  ],
};
const screen = (clip: string, start: number, duration: number, offset = 0): Segment => ({ type: "screen", clip_id: clip, clip_offset: offset, start, duration });
const recording: Timeline = {
  segments: [
    screen("clip_1", 0, 3, 1.6),
    screen("clip_2", 3, 4, 2),
    screen("clip_3", 7, 3.5, 0),
    { type: "end_card", start: 10.5, duration: 2.5, text: "Happy plants, every day" },
    { type: "text", start: 0, duration: 3, text: "Never forget to water again", overlay: true, style: "hook" },
    caption(3, 4, "Snap a leaf to name it"),
    caption(7, 3.5, "Build a care streak"),
  ],
};

it("renders the preview looks", async () => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", req.url!.endsWith(".png") ? "image/png" : req.url!.endsWith(".jpg") ? "image/jpeg" : "video/mp4");
    createReadStream(D + req.url).pipe(res);
  }).listen(4558);
  const spec = OUTPUT_SPECS.preview;
  const url = (f: string) => `http://localhost:4558/${f}`;
  const accent = await iconAccent(join(D, "icon.png"));
  JSON.parse(readFileSync(join(D, "clips.json"), "utf8"));
  for (const [name, timeline] of Object.entries({ shots, recording })) {
    if (process.env.ONLY && process.env.ONLY !== name) continue;
    for (const look of LOOKS) {
      await renderOutput({
        spec: "preview",
        outFile: join(D, `preview-${name}-${look}.mp4`),
        props: {
          timeline,
          clipUrls: { clip_1: url("clip_1.mp4"), clip_2: url("clip_2.mp4"), clip_3: url("clip_3.mp4") },
          imageUrls: { shot_1: url("shot_1.jpg"), shot_2: url("shot_2.jpg"), shot_3: url("shot_3.jpg"), shot_4: url("shot_4.jpg") },
          watermark: WATERMARK,
          loop: spec.loop,
          baseWidth: spec.width,
          baseHeight: spec.height,
          brand: { name: "Sprout", iconUrl: url("icon.png"), accent },
          scale: SCALE,
          look,
        },
      });
    }
  }
  server.close();
});
