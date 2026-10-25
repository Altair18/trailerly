import { describe, expect, it } from "vitest";
import { reviewsContaining, verifyReviewPhrases } from "@/lib/brief";

const reviews = [
  { text: "Finally I remember to water my plants!", stars: 5 },
  { text: "Super easy to use. I remember to water every week now.", stars: 5 },
  { text: "Easy to use, but crashes sometimes", stars: 3 },
];

describe("review phrases", () => {
  it("counts reviews ignoring case and punctuation", () => {
    expect(reviewsContaining("Easy to use", reviews)).toBe(2);
    expect(reviewsContaining("remember to water", reviews)).toBe(2);
  });
  it("matches whole words only", () => {
    expect(reviewsContaining("eas", reviews)).toBe(0);
  });
  it("drops phrases found in fewer than 2 reviews and duplicates", () => {
    expect(
      verifyReviewPhrases(["easy to use", "Easy to use!", "crashes sometimes", "remember to water"], reviews),
    ).toEqual(["easy to use", "remember to water"]);
  });
});
