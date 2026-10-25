import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env, requireEnv } from "@/lib/env";

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return client;
}

export type Tier = "fast" | "smart";

export const modelFor = (tier: Tier) => (tier === "smart" ? env().ANTHROPIC_MODEL : env().ANTHROPIC_FAST_MODEL);

/** One model call's cost drivers, for logs and the planner comparison script. */
export interface LlmUsage {
  step: string;
  tier: Tier;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

let usageListener: ((u: LlmUsage) => void) | undefined;

/** Receive every call's usage (the comparison script tallies them); logs go to the console either way. */
export function onLlmUsage(listener: ((u: LlmUsage) => void) | undefined) {
  usageListener = listener;
}

export class SchemaError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

/**
 * Ask Claude for JSON and validate it against a zod schema.
 * Stages 3 to 5 all go through here, so everything downstream reads typed data.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  /** JPEG frames to show the model before the prompt. */
  images?: { data: Buffer; label?: string }[];
  /**
   * "fast" (default) runs on the cheap model for labelling and short structured replies;
   * "smart" runs on the main model for copy people read (brief, hooks, plans).
   */
  tier?: Tier;
  /** Thinking effort; lower is cheaper. Defaults: fast -> low, smart -> medium. */
  effort?: "low" | "medium" | "high";
  /** Pipeline step name for the usage log, e.g. "plan:header". */
  step?: string;
}): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    if (img.label) content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: imageType(img.data), data: img.data.toString("base64") } });
  }
  content.push({ type: "text", text: opts.prompt });
  const tier = opts.tier ?? "fast";
  const res = await anthropic().messages.create({
    model: modelFor(tier),
    max_tokens: opts.maxTokens ?? 4096,
    output_config: { effort: opts.effort ?? (tier === "fast" ? "low" : "medium") },
    system: `${opts.system}\n\nReply with a single JSON object and nothing else.`,
    messages: [{ role: "user", content }],
  });

  const usage: LlmUsage = {
    step: opts.step ?? "unnamed",
    tier,
    model: res.model,
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
  };
  console.info(`[llm] ${JSON.stringify(usage)}`);
  usageListener?.(usage);

  if (res.stop_reason === "refusal") throw new SchemaError("The model declined this request", "");
  if (res.stop_reason === "max_tokens") throw new SchemaError("The reply was cut off before it finished", "");
  const text = res.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SchemaError("Model did not return valid JSON", text);
  }
  const result = opts.schema.safeParse(parsed);
  if (!result.success) {
    throw new SchemaError(result.error.message, text);
  }
  return result.data;
}

/** Media type from the file's first bytes (App Store screenshots can be PNG, JPEG or WebP). */
export function imageType(data: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (data[0] === 0x89 && data[1] === 0x50) return "image/png";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (data.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return "image/jpeg";
}
