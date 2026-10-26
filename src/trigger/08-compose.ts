import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { iconAccent, iconStyle } from "@/lib/media/accent";
import { lintLandscapeTimeline } from "@/lib/media/render-lint";
import { appScreenshots } from "@/lib/media/screenshots";
import { type MusicManifest, soundtrackFor } from "@/lib/media/music";
import { readFile } from "node:fs/promises";
import { loadPackWithApp, readyClips } from "@/lib/packs";
import { Listing } from "@/lib/schemas/listing";
import { renderOutput, renderStillImage } from "@/lib/render";
import { DRAFT_SCALE, isLandscape, OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { stillSecond, stillsFor } from "@/lib/specs/stills";
import { paths, signedUrls, uploadFile } from "@/lib/storage";
import { Timeline } from "@/lib/timeline/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FinalPayload } from "./payload";

/**
 * Something readable for a failed render. Remotion and child processes can throw errors with an empty
 * message (or non-Error values), which used to log as nothing at all.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message.trim() || err.stack?.split("\n").slice(0, 3).join(" | ") || err.name;
  if (typeof err === "string") return err || "Unknown error";
  try {
    return JSON.stringify(err) ?? "Unknown error";
  } catch {
    return String(err);
  }
}

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
    // The landscape stage lights itself in the app's own colour, read from its icon.
    const clips = await readyClips(packId);
    const urls = await signedUrls(clips.map((c) => c.path), 6 * 3600);
    const clipUrls = Object.fromEntries(clips.map((c) => [c.id, urls[c.path]!]));
    const listing = Listing.safeParse(app.listing_json);
    // The app's colours and type dress every frame (agency videos never share one template between apps).
    const brand = {
      name: app.name,
      iconUrl: app.icon_url,
      accent: await iconAccent(app.icon_url),
      style: await iconStyle(app.icon_url, listing.success ? listing.data.genre : null),
    };
    // The preview's music comes from the library made once with ElevenLabs (public/music); none until it's made.
    const manifest = await readFile(join(process.cwd(), "public/music/manifest.json"), "utf8").then((t) => JSON.parse(t) as MusicManifest).catch(() => null);
    const soundtrack = soundtrackFor(manifest, listing.success ? listing.data.genre : null, packId);
    const imageUrls = Object.fromEntries(appScreenshots(listing.success ? listing.data : null).map((s) => [s.id, s.url]));

    const rendered: OutputSpecId[] = [];
    const failed: OutputSpecId[] = [];
    const dir = await mkdtemp(join(tmpdir(), "render-"));
    try {
      for (const id of specs) {
        const spec = OUTPUT_SPECS[id];
        const { data: output, error } = await db.from("outputs").select("*").eq("pack_id", packId).eq("spec", id).single();
        if (error) throw error;
        await db.from("outputs").update({ status: "rendering", error: null }).eq("id", output.id);
        try {
          const file = join(dir, `${id}.mp4`);
          const timeline = Timeline.parse(output.timeline_json);
          const props = {
            timeline,
            clipUrls,
            imageUrls,
            watermark: true,
            loop: spec.loop,
            baseWidth: spec.width,
            baseHeight: spec.height,
            safeArea: spec.safeArea,
            brand,
            scale: DRAFT_SCALE,
            soundtrack: id === "preview" ? soundtrack : undefined,
          };
          await renderOutput({
            spec: id,
            outFile: file,
            props,
            onProgress: (p) => metadata.set(`progress.${id}`, Math.round(p * 100)),
          });
          // Pacing checks on header and search: logged so slow or crowded cuts show up in run logs, never blocking.
          if (isLandscape(spec)) {
            const issues = lintLandscapeTimeline(timeline);
            if (issues.length) logger.warn("Render lint", { packId, spec: id, issues });
          }
          // iOS 27 stills come from the same timeline, at the hook's strongest frame.
          for (const still of stillsFor(id)) {
            try {
              const png = join(dir, `still-${still.id}.png`);
              await renderStillImage({
                still: still.id,
                props: { ...props, loop: false, baseWidth: still.width, baseHeight: still.height, safeArea: still.safeArea },
                frame: Math.round(stillSecond(timeline) * spec.fps),
                outFile: png,
              });
              await uploadFile(paths.draftStill(packId, still.id), png, "image/png");
            } catch (err) {
              logger.warn("Still failed; the video is still fine", { packId, still: still.id, error: (err as Error).message });
            }
          }
          await uploadFile(paths.draft(packId, id), file, "video/mp4");
          await db
            .from("outputs")
            .update({ status: "ready", draft_url: paths.draft(packId, id), updated_at: new Date().toISOString() })
            .eq("id", output.id);
          logger.info("Draft rendered", { packId, spec: id });
          rendered.push(id);
        } catch (err) {
          // One output failing (say the header) shouldn't stop the others; the drafts page offers a retry.
          await db.from("outputs").update({ status: "failed", error: errorText(err) }).eq("id", output.id);
          logger.error("Draft failed", { packId, spec: id, error: errorText(err) });
          failed.push(id);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    if (rendered.length === 0) throw new Error(`No drafts rendered (${failed.join(", ")} failed).`);
    return { rendered, failed };
  },
});
