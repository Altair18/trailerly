import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, task } from "@trigger.dev/sdk";
import { renderOutput } from "@/lib/render";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";

/**
 * Renders a 3-second text-only preview at draft size, with no clips or network media.
 * Run it from the Trigger.dev dashboard (or `npm run smoke:render`) after every deploy:
 * if it fails, the worker image can't render and every draft would fail too.
 */
export const renderSmoke = task({
  id: "render-smoke",
  machine: "large-1x",
  maxDuration: 600,
  run: async () => {
    const spec = OUTPUT_SPECS.preview;
    const dir = await mkdtemp(join(tmpdir(), "smoke-"));
    try {
      const file = join(dir, "smoke.mp4");
      const started = Date.now();
      await renderOutput({
        spec: "preview",
        outFile: file,
        props: {
          timeline: {
            segments: [
              { type: "text", start: 0, duration: 3, text: "Render check" },
              { type: "text", overlay: true, style: "brand", start: 1, duration: 2 },
            ],
          },
          clipUrls: {},
          watermark: true,
          loop: false,
          baseWidth: spec.width,
          baseHeight: spec.height,
          brand: { name: "Trailerly", iconUrl: null },
          scale: 1 / 6,
        },
      });
      const { size } = await stat(file);
      if (size < 1000) throw new Error(`Render produced a ${size}-byte file`);
      const seconds = Math.round((Date.now() - started) / 100) / 10;
      logger.info("Render smoke test passed", { bytes: size, seconds });
      return { ok: true, bytes: size, seconds };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
