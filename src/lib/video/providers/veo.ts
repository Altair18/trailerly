import { env } from "@/lib/env";
import type { SceneRequest, SceneResult, VideoProvider } from "../types";

// USD per second at 1080p, from the spec. Converted at a rough rate; replace with real billing data.
const USD_PER_SECOND = { lite: 0.08, fast: 0.12 } as const;
const PENCE_PER_USD = 79;

export const veo: VideoProvider = {
  name: "veo",
  async generate(req: SceneRequest): Promise<SceneResult> {
    const model = req.tier === "lite" ? env().VEO_MODEL_LITE : env().VEO_MODEL_FAST;
    // TODO(M3): call Gemini API (@google/genai) generateVideos, poll the operation,
    // upload the clip to Supabase Storage and return its URL.
    void model;
    throw new Error("Veo provider not implemented yet");
  },
};

export function veoCostPence(req: SceneRequest): number {
  return Math.ceil(req.seconds * USD_PER_SECOND[req.tier] * PENCE_PER_USD);
}
