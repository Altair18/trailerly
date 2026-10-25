import type { SceneRequest, SceneResult, VideoProvider } from "../types";

// Fallback model (Kling or Hailuo) through fal; also used for upscaling.
export const fal: VideoProvider = {
  name: "fal",
  async generate(_req: SceneRequest): Promise<SceneResult> {
    // TODO(M3): call @fal-ai/client with env().FAL_FALLBACK_MODEL.
    throw new Error("fal provider not implemented yet");
  },
};

export async function upscale(_clipUrl: string, _width: number, _height: number): Promise<string> {
  // TODO(M3): call env().FAL_UPSCALE_MODEL and return the upscaled clip URL.
  throw new Error("Upscaling not implemented yet");
}
