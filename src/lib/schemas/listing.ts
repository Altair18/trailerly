import { z } from "zod";

export const Listing = z.object({
  store_id: z.string(),
  country: z.string(),
  name: z.string(),
  description: z.string(),
  icon_url: z.string(),
  screenshot_urls: z.array(z.string()),
  genre: z.string().optional(),
});
export type Listing = z.infer<typeof Listing>;

/** Reviews keep text and stars only; reviewer names are dropped at ingest. */
export const Review = z.object({ text: z.string(), stars: z.number().int().min(1).max(5) });
export type Review = z.infer<typeof Review>;
