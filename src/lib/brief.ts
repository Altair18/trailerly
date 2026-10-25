import type { Review } from "@/lib/schemas/listing";

const normalise = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Number of reviews that contain the phrase, ignoring case and punctuation. */
export function reviewsContaining(phrase: string, reviews: Review[]): number {
  const p = normalise(phrase);
  if (!p) return 0;
  return reviews.filter((r) => ` ${normalise(r.text)} `.includes(` ${p} `)).length;
}

/** Keep only phrases that really appear in 2 or more reviews (the model's claim isn't trusted). */
export function verifyReviewPhrases(phrases: string[], reviews: Review[], minReviews = 2): string[] {
  const seen = new Set<string>();
  return phrases.filter((phrase) => {
    const key = normalise(phrase);
    if (seen.has(key) || reviewsContaining(phrase, reviews) < minReviews) return false;
    seen.add(key);
    return true;
  });
}
