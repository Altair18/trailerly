import { logger, task } from "@trigger.dev/sdk";
import { fetchListing, fetchReviews } from "@/lib/ingest/appstore";
import { loadPackWithApp } from "@/lib/packs";
import type { Listing, Review } from "@/lib/schemas/listing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/**
 * Stage 1: refresh the listing and pull recent reviews from Apple's public endpoints.
 * Reviews are returned to the caller and never stored; only the brief's short phrases are kept.
 */
export const ingestListing = task({
  id: "ingest-listing",
  run: async ({ packId }: PackPayload): Promise<{ listing: Listing; reviews: Review[] }> => {
    const { app } = await loadPackWithApp(packId);
    const link = { storeId: app.store_id, country: app.country };
    const [listing, reviews] = await Promise.all([fetchListing(link), fetchReviews(link)]);

    await supabaseAdmin()
      .from("apps")
      .update({ name: listing.name, icon_url: listing.icon_url, listing_json: listing, fetched_at: new Date().toISOString() })
      .eq("id", app.id);

    logger.info("Ingested listing", { name: listing.name, reviews: reviews.length });
    return { listing, reviews };
  },
});
