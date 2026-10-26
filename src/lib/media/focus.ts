import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

import { FOCUS_FPS, FOCUS_H, FOCUS_W, motionFocus, type FocusPoint } from "@/lib/timeline/focus";

/** Focus points for a clip file, read from small grey frames. */
export async function clipFocus(file: string): Promise<FocusPoint[]> {
  const { stdout } = await run(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vf", `fps=${FOCUS_FPS},scale=${FOCUS_W}:${FOCUS_H},format=gray`, "-f", "rawvideo", "-"],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  const size = FOCUS_W * FOCUS_H;
  const frames: Uint8Array[] = [];
  for (let i = 0; i + size <= stdout.length; i += size) frames.push(new Uint8Array(stdout.subarray(i, i + size)));
  return motionFocus(frames, FOCUS_W, FOCUS_H, FOCUS_FPS);
}
