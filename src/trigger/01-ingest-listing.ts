import { logger, task } from "@trigger.dev/sdk";
import { fetchListing, fetchReviews, parseAppStoreLink } from "@/lib/ingest/appstore";
import type { Listing, Review } from "@/lib/schemas/listing";

/** Stage 1: fetch the listing and recent reviews from Apple's public endpoints. */
export const ingestListing = task({
  id: "ingest-listing",
  run: async ({ link }: { link: string }): Promise<{ listing: Listing; reviews: Review[] }> => {
    const parsed = parseAppStoreLink(link);
    if (!parsed) throw new Error(`Not an App Store link: ${link}`);
    const [listing, reviews] = await Promise.all([fetchListing(parsed), fetchReviews(parsed)]);
    logger.info("Ingested listing", { name: listing.name, reviews: reviews.length });
    // TODO(M1): upsert into `apps` (listing_json) for the signed-in user.
    return { listing, reviews };
  },
});
