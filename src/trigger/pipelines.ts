import { task } from "@trigger.dev/sdk";
import { setStage } from "@/lib/packs";
import { ingestListing } from "./01-ingest-listing";
import { writeBrief } from "./03-write-brief";
import { writeHooks } from "./04-write-hooks";
import { planTimelines } from "./05-plan-timelines";
import { generateScenes } from "./06-generate-scenes";
import { voiceCaptions } from "./07-voice-captions";
import { compose } from "./08-compose";
import { checkRules } from "./09-check-rules";
import { packagePack } from "./10-package";
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
    await setStage(packId, "writing_hooks");
    const { hooks } = await writeHooks.triggerAndWait({ packId, brief }).unwrap();
    await setStage(packId, "review");
    return { brief, hooks };
  },
  onFailure: async ({ payload, error }) => {
    await setStage(payload.packId, "error", error instanceof Error ? error.message : String(error));
  },
});

/** Brief approved and hooks picked -> watermarked drafts with rule results. */
export const renderDrafts = task({
  id: "render-drafts",
  run: async ({ packId }: PackPayload) => {
    // TODO(M2): load brief, chosen hooks and clips from the database as planner context.
    const { timelines } = await planTimelines.triggerAndWait({ packId, context: {} }).unwrap();
    await generateScenes.triggerAndWait({ packId }).unwrap();
    await voiceCaptions.triggerAndWait({ packId }).unwrap();
    await compose.triggerAndWait({ packId, final: false }).unwrap();
    return checkRules.triggerAndWait({ packId, timelines }).unwrap();
  },
});

/** Paid -> full-resolution renders and the zip. Triggered by the Stripe webhook. */
export const renderFinal = task({
  id: "render-final",
  run: async ({ packId }: PackPayload) => {
    await compose.triggerAndWait({ packId, final: true }).unwrap();
    return packagePack.triggerAndWait({ packId }).unwrap();
  },
});
