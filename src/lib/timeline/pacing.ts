// Header and search pacing, from top apps' App Store videos: something changes at least every 5 s, and the
// logo close is short. The templates are built to these numbers and render-lint checks them.

/** Longest a single shot should hold before something changes. */
export const MAX_BEAT_SECONDS = 5;
/** Longest the closing logo should stay up. */
export const MAX_OUTRO_SECONDS = 2;
