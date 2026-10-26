// Generates Trailerly's fixed music library with ElevenLabs, once. Run on a machine with the key:
//   node --env-file=.env.local scripts/music/generate.mjs
// Writes public/music/*.mp3 (beds normalised to -14 LUFS, effects to -18 LUFS) and public/music/manifest.json.
// Re-running skips files that already exist; delete one to make it again.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY is not set (run with --env-file=.env.local).");
const OUT = join(process.cwd(), "public", "music");
mkdirSync(OUT, { recursive: true });

// Each bed: 32 s, instrumental, a clear start and a resolved ending, no vocals, built to sit under a 15-30 s app preview.
const BASE = "Instrumental only, no vocals. 32 seconds. Starts immediately with no silence, steady energy, ends on a clean resolved final chord. Modern, polished, made for an app promo video.";
const BEDS = [
  { id: "bright-pop", moods: ["upbeat", "playful"], prompt: `Bright upbeat pop with plucked synths, claps and a light four-on-the-floor kick, 118 BPM, optimistic. ${BASE}` },
  { id: "calm-lofi", moods: ["calm", "warm"], prompt: `Warm lo-fi hip hop with soft Rhodes chords, gentle vinyl texture and a relaxed beat, 84 BPM, cosy. ${BASE}` },
  { id: "tech-pulse", moods: ["focused", "tech"], prompt: `Clean minimal electronic with a pulsing synth bass, crisp hi-hats and airy pads, 110 BPM, focused and smart. ${BASE}` },
  { id: "acoustic-sun", moods: ["warm", "natural"], prompt: `Light acoustic guitar and ukulele with hand percussion and glockenspiel, 100 BPM, sunny and natural. ${BASE}` },
  { id: "cinematic-rise", moods: ["premium", "calm"], prompt: `Elegant cinematic piano and soft strings with a slow building pulse, 90 BPM, premium and inspiring. ${BASE}` },
  { id: "energy-drive", moods: ["energetic", "sport"], prompt: `Energetic electronic rock with driving drums, punchy bass and bright synth stabs, 128 BPM, motivating. ${BASE}` },
  { id: "game-bounce", moods: ["playful", "game"], prompt: `Bouncy playful game-style music with marimba, pizzicato strings and cheerful synth leads, 120 BPM, fun. ${BASE}` },
  { id: "soft-corporate", moods: ["trust", "calm"], prompt: `Soft modern corporate track with light piano, muted guitar and gentle percussion, 105 BPM, trustworthy and clear. ${BASE}` },
];
const EFFECTS = [
  { id: "tap", text: "A single soft, clean UI tap click on a phone screen, short and subtle", seconds: 0.5 },
  { id: "whoosh", text: "A short soft airy whoosh transition, smooth and modern, for a UI card sliding in", seconds: 0.8 },
  { id: "pop", text: "A gentle bright pop chime for an app icon appearing, short and pleasant", seconds: 0.8 },
];

async function post(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Loudness-normalise to `lufs` with ffmpeg's loudnorm, as stereo 44.1 kHz MP3. */
function normalise(raw, out, lufs) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=11`, "-ar", "44100", "-ac", "2", "-b:a", "192k", out]);
}

const manifest = { beds: [], effects: [] };
for (const bed of BEDS) {
  const out = join(OUT, `${bed.id}.mp3`);
  if (!existsSync(out)) {
    console.log(`Composing ${bed.id}…`);
    const raw = join(OUT, `${bed.id}.raw.mp3`);
    writeFileSync(raw, await post("/v1/music", { prompt: bed.prompt, music_length_ms: 32000, force_instrumental: true }));
    normalise(raw, out, -14);
    execFileSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", raw] : [raw]);
  }
  manifest.beds.push({ id: bed.id, file: `music/${bed.id}.mp3`, moods: bed.moods });
}
for (const fx of EFFECTS) {
  const out = join(OUT, `${fx.id}.mp3`);
  if (!existsSync(out)) {
    console.log(`Making effect ${fx.id}…`);
    const raw = join(OUT, `${fx.id}.raw.mp3`);
    writeFileSync(raw, await post("/v1/sound-generation", { text: fx.text, duration_seconds: fx.seconds, prompt_influence: 0.6 }));
    normalise(raw, out, -18);
    execFileSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", raw] : [raw]);
  }
  manifest.effects.push({ id: fx.id, file: `music/${fx.id}.mp3` });
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Done: ${manifest.beds.length} beds, ${manifest.effects.length} effects in public/music.`);
