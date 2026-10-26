// Landing page price copy, in one place so a price test only changes this file.
// Set a price to null to show "Price coming soon" instead.

export const PRICES = {
  /** App Store set: preview, header, search and stills. */
  launch: "£19" as string | null,
  /** Adds A/B variants and the social ads once they ship. Being tested at £39 to £49. */
  full: null as string | null,
};

/** True once checkout and full-size download are live in the pack flow. */
export const CHECKOUT_LIVE = false;

/** "from £19", or a fallback when no price is set. */
export const fromPrice = () => (PRICES.launch ? `from ${PRICES.launch}` : "low one-off price");
