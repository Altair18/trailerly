import { logger, task } from "@trigger.dev/sdk";
import { verifyReviewPhrases } from "@/lib/brief";
import { generateJson } from "@/lib/llm/claude";
import { type Brief, BriefDraft } from "@/lib/schemas/brief";
import { fitsWordLimit } from "@/lib/schemas/hooks";
import type { Listing, Review } from "@/lib/schemas/listing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

const SYSTEM = `You write short, factual marketing briefs for iPhone apps, used to make App Store videos and social ads.
Use only facts from the listing and reviews. Never invent features.
Return JSON with:
- what_it_does: one sentence, plain words.
- audience: who it is for, one sentence.
- features: 3 to 5 key features, each a short phrase.
- review_phrases: up to 10 phrases copied word for word from the reviews, each 8 words or fewer,
  each appearing in 2 or more different reviews. Prefer phrases about benefits. Return [] if none repeat.
- tone: 2 to 4 words describing the app's voice (e.g. "calm, encouraging").`;

/** Stage 3: listing plus reviews in, an editable brief out. */
export const writeBrief = task({
  id: "write-brief",
  run: async ({ packId, listing, reviews }: PackPayload & { listing: Listing; reviews: Review[] }) => {
    const draft = await generateJson({
      schema: BriefDraft,
      system: SYSTEM,
      prompt: JSON.stringify({
        listing: { name: listing.name, genre: listing.genre, description: listing.description },
        reviews: reviews.map((r) => ({ stars: r.stars, text: r.text })),
      }),
    });
    // Drop over-long phrases and any that don't really repeat across reviews; keep the cap of 10.
    const phrases = verifyReviewPhrases(draft.review_phrases.filter((p) => fitsWordLimit(p)), reviews).slice(0, 10);
    const brief: Brief = { ...draft, review_phrases: phrases };

    const { error } = await supabaseAdmin().from("packs").update({ brief_json: brief }).eq("id", packId);
    if (error) throw error;
    logger.info("Brief written", {
      packId,
      phrasesProposed: draft.review_phrases.length,
      phrasesKept: brief.review_phrases.length,
    });
    return brief;
  },
});
