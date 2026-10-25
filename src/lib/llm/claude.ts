import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env, requireEnv } from "@/lib/env";

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return client;
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
   * "write" (default): brief, hooks and timelines, the copy and cuts people see. ANTHROPIC_MODEL at medium effort.
   * "label": describing clips and screenshots from images, the bulk of the tokens. ANTHROPIC_VISION_MODEL at low effort.
   */
  job?: "write" | "label";
}): Promise<T> {
  const label = opts.job === "label";
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    if (img.label) content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: imageType(img.data), data: img.data.toString("base64") } });
  }
  content.push({ type: "text", text: opts.prompt });
  const res = await anthropic().messages.create({
    model: label ? env().ANTHROPIC_VISION_MODEL : env().ANTHROPIC_MODEL,
    // Thinking tokens count toward max_tokens, so leave room above the JSON itself.
    max_tokens: opts.maxTokens ?? (label ? 4096 : 8192),
    // Medium is a step down from Sonnet's default (high) that keeps quality on these short jobs.
    output_config: { effort: label ? "low" : "medium" },
    system: `${opts.system}\n\nReply with a single JSON object and nothing else.`,
    messages: [{ role: "user", content }],
  });

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
