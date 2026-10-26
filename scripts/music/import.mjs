// Builds Trailerly's music library from free Pixabay tracks (Pixabay Content License: free for commercial use,
// no attribution needed). Download one track per bed below from pixabay.com/music into C:\trailerly\music, named
// after the bed (e.g. music\bright-pop.mp3; any audio format ffmpeg reads), then run:
//   node scripts/music/import.mjs
// Each bed is cut to its first 32 s with a short fade out and normalised to -14 LUFS into public/music, and
// public/music/manifest.json lists the beds found plus the effects (whoosh/pop/tap, made with ffmpeg, already in
// public/music). Beds with no file are left out, so the library can grow one track at a time.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, parse, resolve } from "node:path";

const IN = resolve(process.argv[2] ?? "music");
const OUT = join(process.cwd(), "public", "music");
mkdirSync(OUT, { recursive: true });

// What to look for on Pixabay for each bed: instrumental, steady from the first second, at least 30 s long.
const BEDS = [
  { id: "bright-pop", moods: ["upbeat", "playful"], search: "upbeat pop claps happy" },
  { id: "calm-lofi", moods: ["calm", "warm"], search: "lofi chill rhodes" },
  { id: "tech-pulse", moods: ["focused", "tech"], search: "minimal electronic technology" },
  { id: "acoustic-sun", moods: ["warm", "natural"], search: "acoustic ukulele happy" },
  { id: "cinematic-rise", moods: ["premium", "calm"], search: "inspiring piano strings" },
  { id: "energy-drive", moods: ["energetic", "sport"], search: "energetic sport rock" },
  { id: "game-bounce", moods: ["playful", "game"], search: "playful game marimba" },
  { id: "soft-corporate", moods: ["trust", "calm"], search: "corporate soft piano" },
];
const EFFECTS = ["whoosh", "pop", "tap"];
const SECONDS = 32;

const files = existsSync(IN) ? readdirSync(IN) : [];
const manifest = { beds: [], effects: [] };
for (const bed of BEDS) {
  const src = files.find((f) => parse(f).name.toLowerCase() === bed.id);
  if (!src) {
    console.log(`- ${bed.id}: no file in ${IN} (Pixabay search: "${bed.search}")`);
    continue;
  }
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", join(IN, src), "-t", String(SECONDS),
    "-af", `afade=t=out:st=${SECONDS - 1.5}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11`,
    "-ar", "44100", "-ac", "2", "-b:a", "192k", join(OUT, `${bed.id}.mp3`),
  ]);
  console.log(`+ ${bed.id} <- ${src}`);
  manifest.beds.push({ id: bed.id, file: `music/${bed.id}.mp3`, moods: bed.moods });
}
for (const id of EFFECTS) {
  if (existsSync(join(OUT, `${id}.mp3`))) manifest.effects.push({ id, file: `music/${id}.mp3` });
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Done: ${manifest.beds.length} beds, ${manifest.effects.length} effects in public/music.`);
