import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

export interface Probe {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", file],
    { maxBuffer: MAX_BUFFER },
  );
  const json = JSON.parse(stdout) as {
    streams: Array<{ width: number; height: number; r_frame_rate: string }>;
    format: { duration: string };
  };
  const stream = json.streams[0];
  if (!stream) throw new Error("No video stream found");
  const [num, den] = stream.r_frame_rate.split("/").map(Number);
  return {
    duration: Number(json.format.duration),
    width: stream.width,
    height: stream.height,
    fps: den ? num! / den : num!,
  };
}

/** Re-encode to constant 30 fps H.264, no audio (screen recordings carry none worth keeping). */
export async function normalise(input: string, output: string): Promise<void> {
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

/** Times (seconds) where the picture changes by more than `threshold` (0 to 1). */
export async function sceneChanges(file: string, threshold = 0.3): Promise<number[]> {
  const { stderr } = await run(
    "ffmpeg",
    ["-v", "info", "-i", file, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"],
    { maxBuffer: MAX_BUFFER },
  );
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

export async function cutClip(input: string, output: string, start: number, duration: number): Promise<void> {
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-ss", String(start), "-i", input, "-t", String(duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output],
    { maxBuffer: MAX_BUFFER },
  );
}

export async function poster(input: string, output: string, at = 0.5): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=360:-2", output], {
    maxBuffer: MAX_BUFFER,
  });
}
