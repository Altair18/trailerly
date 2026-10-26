// The music library made once with ElevenLabs (scripts/music/generate.mjs) and shipped in public/music. Pure: the
// manifest is passed in, so the planner and tests can use it without the files.

export interface MusicManifest {
  beds: Array<{ id: string; file: string; moods: string[] }>;
  effects: Array<{ id: string; file: string }>;
}

/** What a video's soundtrack is made of, as paths under public/ (Remotion's staticFile). */
export interface Soundtrack {
  bed?: string;
  whoosh?: string;
  pop?: string;
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
  return { bed: pool[hash(seed) % pool.length]!.file, whoosh: effect("whoosh"), pop: effect("pop") };
}
