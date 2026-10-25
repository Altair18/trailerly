import { z } from "zod";
import { cleanEnv } from "./clean-env";

// Server-side env. Every key is optional at boot so the skeleton runs without
// credentials; call requireEnv() at the point a service is actually used.
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("trailerly"),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Brief, hooks and frame labelling: short, well-specified jobs that a small model handles. */
  ANTHROPIC_MODEL: z.string().default("claude-haiku-5-5"),
  /** Timeline planning, the hardest call. Same small model by default; set to claude-sonnet-5-5 if plans get worse. */
  ANTHROPIC_PLANNER_MODEL: z.string().default("claude-haiku-5-5"),
  GEMINI_API_KEY: z.string().optional(),
  VEO_MODEL_LITE: z.string().default("veo-3.1-lite"),
  VEO_MODEL_FAST: z.string().default("veo-3.1-fast"),
  FAL_KEY: z.string().optional(),
  FAL_FALLBACK_MODEL: z.string().optional(),
  FAL_UPSCALE_MODEL: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PACK: z.string().optional(),
  PACK_PRICE_PENCE: z.coerce.number().int().default(1900),
  PACK_COST_BUDGET_PENCE: z.coerce.number().int().default(700),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof serverSchema>;

let cached: Env | undefined;

export function env(): Env {
  // Strip stray BOM/zero-width characters and whitespace; treat empty strings as unset.
  const raw = Object.fromEntries(
    Object.entries(process.env)
      .map(([k, v]) => [k, cleanEnv(v)] as const)
      .filter(([, v]) => v !== undefined),
  );
  cached ??= serverSchema.parse(raw);
  return cached;
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing env var ${String(key)}. See .env.example.`);
  }
  return value as NonNullable<Env[K]>;
}
