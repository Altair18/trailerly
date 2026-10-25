import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { appScreenshots } from "@/lib/media/screenshots";
import { loadPackWithApp, readyClips } from "@/lib/packs";
import { Listing } from "@/lib/schemas/listing";
import { renderOutput } from "@/lib/render";
import { DRAFT_SCALE, OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { paths, signedUrls, uploadFile } from "@/lib/storage";
import { Timeline } from "@/lib/timeline/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FinalPayload } from "./payload";

/**
 * Stage 8: render each output's Remotion composition from its timeline JSON.
 * Drafts: one third size + watermark. Finals (after payment): upscale AI clips first.
 */
export const compose = task({
  id: "compose",
  machine: "large-1x",
  run: async ({ packId, specs, final }: FinalPayload & { specs: OutputSpecId[] }) => {
    if (final) throw new Error("Final renders arrive with payment (M6).");
    const db = supabaseAdmin();
    const { app } = await loadPackWithApp(packId);
    const brand = { name: app.name, iconUrl: app.icon_url };
    const clips = await readyClips(packId);
    const urls = await signedUrls(clips.map((c) => c.path), 6 * 3600);
    const clipUrls = Object.fromEntries(clips.map((c) => [c.id, urls[c.path]!]));
    const listing = Listing.safeParse(app.listing_json);
    const imageUrls = Object.fromEntries(appScreenshots(listing.success ? listing.data : null).map((s) => [s.id, s.url]));

    const dir = await mkdtemp(join(tmpdir(), "render-"));
    try {
      for (const id of specs) {
        const spec = OUTPUT_SPECS[id];
        const { data: output, error } = await db.from("outputs").select("*").eq("pack_id", packId).eq("spec", id).single();
        if (error) throw error;
        await db.from("outputs").update({ status: "rendering", error: null }).eq("id", output.id);
        try {
          const file = join(dir, `${id}.mp4`);
          await renderOutput({
            spec: id,
            outFile: file,
            props: {
              timeline: Timeline.parse(output.timeline_json),
              clipUrls,
              imageUrls,
              watermark: true,
              loop: spec.loop,
              baseWidth: spec.width,
              baseHeight: spec.height,
              brand,
              scale: DRAFT_SCALE,
            },
            onProgress: (p) => metadata.set(`progress.${id}`, Math.round(p * 100)),
          });
          await uploadFile(paths.draft(packId, id), file, "video/mp4");
          await db
            .from("outputs")
            .update({ status: "ready", draft_url: paths.draft(packId, id), updated_at: new Date().toISOString() })
            .eq("id", output.id);
          logger.info("Draft rendered", { packId, spec: id });
        } catch (err) {
          await db.from("outputs").update({ status: "failed", error: (err as Error).message }).eq("id", output.id);
          throw err;
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    return { rendered: specs.length };
  },
});
