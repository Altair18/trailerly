export interface ClipRange {
  start: number;
  duration: number;
}

export const MIN_CLIP_SECONDS = 2;
export const MIN_CLIPS = 3;
export const MAX_CLIPS = 6;
export const MIN_RECORDING_SECONDS = 20;
export const MAX_RECORDING_SECONDS = 60;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Turn scene-change times into 3 to 6 clips of at least 2 seconds that cover the recording.
 * Short pieces merge into a neighbour; extra pieces merge where the join is shortest;
 * too few pieces split the longest one in half.
 */
export function planClips(duration: number, cuts: number[], opts = { min: MIN_CLIP_SECONDS, minClips: MIN_CLIPS, maxClips: MAX_CLIPS }): ClipRange[] {
  const points = [0, ...[...new Set(cuts)].filter((t) => t > 0 && t < duration).sort((a, b) => a - b), duration];
  let ranges: ClipRange[] = points.slice(1).map((end, i) => ({ start: points[i]!, duration: end - points[i]! }));

  const mergeAt = (i: number) => {
    // Merge range i with range i + 1.
    const a = ranges[i]!;
    const b = ranges[i + 1]!;
    ranges.splice(i, 2, { start: a.start, duration: a.duration + b.duration });
  };

  // Fold short pieces into the shorter neighbour.
  for (let i = 0; i < ranges.length && ranges.length > 1; ) {
    if (ranges[i]!.duration >= opts.min) {
      i++;
      continue;
    }
    const prev = ranges[i - 1];
    const next = ranges[i + 1];
    if (!next || (prev && prev.duration <= next.duration)) mergeAt(i - 1);
    else mergeAt(i);
    i = Math.max(0, i - 1);
  }

  // Too many: merge the adjacent pair with the smallest combined length.
  while (ranges.length > opts.maxClips) {
    let best = 0;
    for (let i = 1; i < ranges.length - 1; i++) {
      if (ranges[i]!.duration + ranges[i + 1]!.duration < ranges[best]!.duration + ranges[best + 1]!.duration) best = i;
    }
    mergeAt(best);
  }

  // Too few: split the longest piece in half while both halves stay long enough.
  while (ranges.length < opts.minClips) {
    const i = ranges.reduce((best, r, k) => (r.duration > ranges[best]!.duration ? k : best), 0);
    const r = ranges[i]!;
    if (r.duration / 2 < opts.min) break;
    ranges.splice(i, 1, { start: r.start, duration: r.duration / 2 }, { start: r.start + r.duration / 2, duration: r.duration / 2 });
  }

  ranges = ranges.map((r) => ({ start: round(r.start), duration: round(r.duration) }));
  return ranges;
}
