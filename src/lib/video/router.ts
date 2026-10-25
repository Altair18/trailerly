import { createHash } from "node:crypto";
import type { OutputSpecId } from "@/lib/specs/outputs";
import { fal } from "./providers/fal";
import { veo } from "./providers/veo";
import type { SceneRequest, SceneResult, VideoProvider, VideoTier } from "./types";

/** Social ads use the cheaper tier; header and search use Fast, then upscale. */
export function tierFor(spec: OutputSpecId): VideoTier {
  return spec.startsWith("social_") ? "lite" : "fast";
}

/** Same prompt and settings means the same clip, at no new cost. */
export function promptHash(req: SceneRequest): string {
  return createHash("sha256")
    .update(JSON.stringify([req.prompt, req.seconds, req.aspectRatio, req.tier]))
    .digest("hex");
}

/** Primary first, then fallbacks. Swapping models is a change to this list. */
const PROVIDERS: VideoProvider[] = [veo, fal];

export async function generateScene(req: SceneRequest): Promise<SceneResult> {
  const errors: string[] = [];
  for (const provider of PROVIDERS) {
    try {
      return await provider.generate(req);
    } catch (err) {
      errors.push(`${provider.name}: ${(err as Error).message}`);
    }
  }
  throw new Error(`All video providers failed. ${errors.join("; ")}`);
}

/** Split a scene longer than 8 seconds into clips Veo can make. */
export function splitSeconds(total: number, max = 8, min = 4): number[] {
  const parts: number[] = [];
  let left = total;
  while (left > max) {
    const take = left - max < min ? left - min : max;
    parts.push(take);
    left -= take;
  }
  parts.push(left);
  return parts;
}
