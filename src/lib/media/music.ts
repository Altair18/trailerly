// The music library (free Pixabay beds imported by scripts/music/import.mjs, ffmpeg-made effects) shipped in public/music. Pure: the
// manifest is passed in, so the planner and tests can use it without the files.

/** A bed's beat grid (scripts/music/beats.mjs): beats per minute and the time of the first beat in seconds. */
export interface BeatGrid {
  bpm: number;
  beat0: number;
}

export interface MusicManifest {
  beds: Array<{ id: string; file: string; moods: string[] } & Partial<BeatGrid>>;
  effects: Array<{ id: string; file: string }>;
}

/** What a video's soundtrack is made of, as paths under public/ (Remotion's staticFile). */
export interface Soundtrack {
  bed?: string;
  whoosh?: string;
  pop?: string;
  /** The bed's beats, so cuts can land on them. */
  beats?: BeatGrid;
}

const GENRE_MOODS: Array<[RegExp, string[]]> = [
  [/game/i, ["game", "playful"]],
  [/sport|fitness/i, ["energetic", "sport"]],
  [/health|medical|lifestyle|food|travel|weather/i, ["warm", "natural", "calm"]],
  [/finance|business|productivity|utilities|developer/i, ["focused", "tech", "trust"]],
  [/education|book|reference|kids/i, ["calm", "warm", "playful"]],
  [/photo|video|music|entertainment|social/i, ["upbeat", "playful"]],
];

/** A small stable number from a string, so a pack keeps the same track across re-renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The bed that suits the app's genre (any bed when none matches), chosen per pack, plus the transition effects. */
export function soundtrackFor(manifest: MusicManifest | null, genre: string | null | undefined, seed: string): Soundtrack {
  if (!manifest || manifest.beds.length === 0) return {};
  const moods = GENRE_MOODS.find(([re]) => genre && re.test(genre))?.[1] ?? ["upbeat", "warm", "focused"];
  const fit = manifest.beds.filter((b) => b.moods.some((m) => moods.includes(m)));
  const pool = fit.length ? fit : manifest.beds;
  const effect = (id: string) => manifest.effects.find((e) => e.id === id)?.file;
  const bed = pool[hash(seed) % pool.length]!;
  const beats = bed.bpm && bed.beat0 !== undefined ? { bpm: bed.bpm, beat0: bed.beat0 } : undefined;
  return { bed: bed.file, whoosh: effect("whoosh"), pop: effect("pop"), ...(beats ? { beats } : {}) };
}
