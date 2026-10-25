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
}): Promise<T> {
  const res = await anthropic().messages.create({
    model: env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: `${opts.system}\n\nReply with a single JSON object and nothing else.`,
    messages: [{ role: "user", content: opts.prompt }],
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
