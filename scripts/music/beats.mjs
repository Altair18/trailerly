// Finds a music bed's beat grid (tempo and the time of the first beat), so the preview can cut on the beat the way
// agency edits do. Spectral-flux onsets, tempo from their autocorrelation (weighted towards 120 BPM, the usual
// promo tempo), phase from the offset whose beats land on the strongest onsets.
//   node scripts/music/beats.mjs            adds "bpm" and "beat0" to every bed in public/music/manifest.json
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const WIN = 1024;
const HOP = 512;
const FPS = RATE / HOP;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k), s = Math.sin(a * k);
        const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
        const xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

/** Onset strength per frame: how much louder each frequency got since the last frame, summed (log magnitudes). */
export function onsetEnvelope(samples) {
  const frames = Math.max(0, Math.floor((samples.length - WIN) / HOP));
  const env = new Float64Array(frames);
  let prev = new Float64Array(WIN / 2);
  const hann = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));
  for (let f = 0; f < frames; f++) {
    const re = new Float64Array(WIN), im = new Float64Array(WIN);
    for (let i = 0; i < WIN; i++) re[i] = samples[f * HOP + i] * hann[i];
    fft(re, im);
    const mag = new Float64Array(WIN / 2);
    let flux = 0;
    for (let k = 1; k < WIN / 2; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      flux += Math.max(0, mag[k] - prev[k]);
    }
    env[f] = flux;
    prev = mag;
  }
  // Take away the local mean so sustained loud parts don't count as onsets.
  const out = new Float64Array(frames);
  const half = Math.round(FPS * 0.25);
  for (let f = 0; f < frames; f++) {
    let sum = 0, n = 0;
    for (let g = Math.max(0, f - half); g <= Math.min(frames - 1, f + half); g++, n++) sum += env[g];
    out[f] = Math.max(0, env[f] - sum / n);
  }
  return out;
}

/** Tempo and first beat from an onset envelope: { bpm, beat0 } in beats per minute and seconds. */
export function beatGrid(env) {
  let best = { score: -Infinity, lag: 0 };
  const minLag = Math.round((60 / 180) * FPS), maxLag = Math.round((60 / 70) * FPS);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < env.length; f++) s += env[f] * env[f - lag];
    const bpm = (60 * FPS) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.7) ** 2);
    const score = (s / (env.length - lag)) * prior;
    if (score > best.score) best = { score, lag };
  }
  // Refine the period to a fraction of a frame by trying nearby periods against the whole track.
  let period = best.lag, phaseBest = { score: -Infinity, offset: 0, period };
  for (let p = best.lag - 1; p <= best.lag + 1; p += 0.05) {
    for (let offset = 0; offset < p; offset += 0.5) {
      let s = 0;
      for (let t = offset; t < env.length; t += p) s += env[Math.round(t)] ?? 0;
      if (s > phaseBest.score) phaseBest = { score: s, offset, period: p };
    }
  }
  period = phaseBest.period;
  return { bpm: Math.round(((60 * FPS) / period) * 100) / 100, beat0: Math.round(((phaseBest.offset * HOP) / RATE + WIN / 2 / RATE) * 1000) / 1000 };
}

export function decode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

export const gridOf = (file) => beatGrid(onsetEnvelope(decode(file)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = join(process.cwd(), "public", "music", "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  for (const bed of manifest.beds) {
    Object.assign(bed, gridOf(join(process.cwd(), "public", bed.file)));
    console.log(`${bed.id}: ${bed.bpm} BPM, first beat ${bed.beat0}s`);
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}
