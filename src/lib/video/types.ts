export type VideoTier = "lite" | "fast";

export interface SceneRequest {
  prompt: string;
  /** Veo makes 4 to 8 second clips; longer scenes are split by the caller. */
  seconds: number;
  aspectRatio: "9:16" | "16:9" | "21:9" | "3:2";
  tier: VideoTier;
}

export interface SceneResult {
  clipUrl: string;
  model: string;
  seconds: number;
  costPence: number;
}

export interface VideoProvider {
  name: string;
  generate(req: SceneRequest): Promise<SceneResult>;
}
