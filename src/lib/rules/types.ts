import type { OutputSpec } from "@/lib/specs/outputs";
import type { Timeline } from "@/lib/timeline/schema";

export type RuleOutcome = "pass" | "warn" | "block";

export interface RuleInput {
  spec: OutputSpec;
  timeline: Timeline;
  /** All on-screen text and voiceover, flattened. */
  texts: string[];
  /** Prompts for AI scenes. */
  prompts: string[];
}

export interface RuleResult {
  rule: string;
  result: RuleOutcome;
  detail?: string;
  /** Effects that apply even on pass, e.g. "add C2PA credentials". */
  effects?: Array<"c2pa" | "ai_label">;
}

export interface Rule {
  id: string;
  /** Plain rules run first; classifier rules call a model and run only when needed. */
  kind: "plain" | "classifier";
  appliesTo: (spec: OutputSpec) => boolean;
  check: (input: RuleInput) => RuleResult | Promise<RuleResult>;
}
