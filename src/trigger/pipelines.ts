import { logger, task } from "@trigger.dev/sdk";
import { loadPackWithApp, setStage } from "@/lib/packs";
import { ChosenHooks, type Hook } from "@/lib/schemas/hooks";
import { variantHooks } from "@/lib/timeline/variants";
import { ingestListing } from "./01-ingest-listing";
import { writeBrief } from "./03-write-brief";
import { writeShotListTask } from "./03b-write-shot-list";
import { writeHooks } from "./04-write-hooks";
import { planTimelines } from "./05-plan-timelines";
import { compose } from "./08-compose";
import { checkRules } from "./09-check-rules";
import { packagePack } from "./10-package";
import { finalStatus } from "@/lib/payment";
import { draftSpecsFor } from "@/lib/specs/outputs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackStatus } from "@/types/db";
import type { PackPayload } from "./payload";

// The pipeline pauses for the user twice (edit brief + pick hooks, then pay),
// so it is three runs rather than one.

/** Link pasted -> listing, brief and hooks for the user to review. */
export const preparePack = task({
  id: "prepare-pack",
  retry: { maxAttempts: 1 }, // each stage retries on its own
  run: async ({ packId }: PackPayload) => {
    await setStage(packId, "ingesting");
    const { listing, reviews } = await ingestListing.triggerAndWait({ packId }).unwrap();
    await setStage(packId, "writing_brief");
    const brief = await writeBrief.triggerAndWait({ packId, listing, reviews }).unwrap();
    // The shot list is a guide, not a gate: if it fails the user can still record and upload.
    const shots = await writeShotListTask.triggerAndWait({ packId, brief, appName: listing.name });
    if (!shots.ok) logger.warn("No shot list", { packId });
    await setStage(packId, "writing_hooks");
    const { hooks } = await writeHooks.triggerAndWait({ packId, brief }).unwrap();
    await setStage(packId, "review");
    return { brief, hooks };
  },
  onFailure: async ({ payload, error }) => {
    await setStage(payload.packId, "error", error instanceof Error ? error.message : String(error));
  },
});

/** Brief approved, hooks picked, recording ready -> watermarked drafts with rule results. */
export const renderDrafts = task({
  id: "render-drafts",
  retry: { maxAttempts: 1 },
  run: async ({ packId }: PackPayload) => {
    const { pack } = await loadPackWithApp(packId);
    const chosen = ChosenHooks.parse(pack.chosen_hooks ?? { social: [], headline: null });
    const specs = draftSpecsFor(variantHooks(chosen, (pack.hooks_json ?? []) as Hook[]));
    await planTimelines.triggerAndWait({ packId, specs }).unwrap();
    // generateScenes (M3) and voiceCaptions (M5) join here once their outputs are in DRAFT_SPECS.
    const { rendered } = await compose.triggerAndWait({ packId, specs, final: false }).unwrap();
    return checkRules.triggerAndWait({ packId, specs: rendered }).unwrap();
  },
});

/** Paid -> full-resolution renders of exactly the drafts the user saw. Triggered by the Stripe webhook. */
export const renderFinal = task({
  id: "render-final",
  retry: { maxAttempts: 1 },
  run: async ({ packId }: PackPayload) => {
    const { pack } = await loadPackWithApp(packId);
    const chosen = ChosenHooks.parse(pack.chosen_hooks ?? { social: [], headline: null });
    const specs = draftSpecsFor(variantHooks(chosen, (pack.hooks_json ?? []) as Hook[]));
    await setPackStatus(packId, "rendering");
    const { rendered, failed } = await compose.triggerAndWait({ packId, specs, final: true }).unwrap();
    // The zip is a convenience on top of the single files, so its failure doesn't fail the pack.
    const zipped = await packagePack.triggerAndWait({ packId, specs: rendered });
    if (!zipped.ok) logger.warn("No zip", { packId });
    await setPackStatus(packId, finalStatus(specs, rendered));
    return { rendered, failed };
  },
  onFailure: async ({ payload }) => {
    await setPackStatus(payload.packId, "failed");
  },
});

async function setPackStatus(packId: string, status: PackStatus) {
  const { error } = await supabaseAdmin().from("packs").update({ status }).eq("id", packId);
  if (error) logger.error("Pack status not saved", { packId, status, error: error.message });
}
