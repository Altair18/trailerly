import type { Listing, Review } from "@/lib/schemas/listing";

export interface ParsedLink {
  storeId: string;
  country: string;
}

/** Pull the numeric id and country out of an App Store link. */
export function parseAppStoreLink(link: string): ParsedLink | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)apps\.apple\.com$/.test(url.hostname)) return null;
  const id = url.pathname.match(/\/id(\d+)/)?.[1];
  if (!id) return null;
  const country = url.pathname.match(/^\/([a-z]{2})\//i)?.[1]?.toLowerCase() ?? "us";
  return { storeId: id, country };
}

export async function fetchListing({ storeId, country }: ParsedLink): Promise<Listing> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${storeId}&country=${country}`);
  if (!res.ok) throw new Error(`App Store lookup failed: ${res.status}`);
  const body = (await res.json()) as { resultCount: number; results: Array<Record<string, unknown>> };
  const app = body.results[0];
  if (!app) throw new Error(`No app found for id ${storeId} in ${country}`);
  return {
    store_id: storeId,
    country,
    name: String(app.trackName ?? ""),
    description: String(app.description ?? ""),
    icon_url: String(app.artworkUrl512 ?? app.artworkUrl100 ?? ""),
    screenshot_urls: (app.screenshotUrls as string[] | undefined) ?? [],
    genre: app.primaryGenreName ? String(app.primaryGenreName) : undefined,
  };
}

/** Recent reviews from Apple's public RSS feed. Keeps text and stars only; names are dropped. */
export async function fetchReviews({ storeId, country }: ParsedLink): Promise<Review[]> {
  const res = await fetch(
    `https://itunes.apple.com/${country}/rss/customerreviews/id=${storeId}/sortby=mostrecent/json`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as {
    feed?: { entry?: Array<{ content?: { label?: string }; "im:rating"?: { label?: string } }> };
  };
  return (body.feed?.entry ?? []).flatMap((e) => {
    const text = e.content?.label;
    const stars = Number(e["im:rating"]?.label);
    return text && stars >= 1 && stars <= 5 ? [{ text, stars }] : [];
  });
}
