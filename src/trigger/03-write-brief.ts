import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import { Brief } from "@/lib/schemas/brief";
import type { Listing, Review } from "@/lib/schemas/listing";
import type { PackPayload } from "./payload";

/** Stage 3: listing plus reviews in, an editable brief out. */
export const writeBrief = task({
  id: "write-brief",
  run: async ({ packId, listing, reviews }: PackPayload & { listing: Listing; reviews: Review[] }) => {
    // TODO(M1): tune the prompt; verify each review phrase appears in 2+ reviews in code.
    const brief = await generateJson({
      schema: Brief,
      system:
        "You write short marketing briefs for iPhone apps. Use only facts in the listing and reviews. " +
        "Return what_it_does, audience, features (3 to 5), review_phrases (up to 10, each 8 words or fewer, " +
        "each found in 2 or more reviews), and tone.",
      prompt: JSON.stringify({ listing, reviews: reviews.map((r) => r.text) }),
    });
    logger.info("Brief written", { packId });
    // TODO(M1): save to packs.brief_json.
    return brief;
  },
});
