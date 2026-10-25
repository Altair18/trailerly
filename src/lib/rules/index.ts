import type { OutputSpec } from "@/lib/specs/outputs";
import type { Timeline } from "@/lib/timeline/schema";
import { CLASSIFIER_RULES } from "./checks/classifier";
import { PLAIN_RULES } from "./checks/plain";
import type { RuleInput, RuleOutcome, RuleResult } from "./types";

export * from "./types";

export function buildRuleInput(spec: OutputSpec, timeline: Timeline): RuleInput {
  return {
    spec,
    timeline,
    texts: [
      ...timeline.segments.flatMap((s) => (s.text ? [s.text] : [])),
      ...(timeline.voiceover ? [timeline.voiceover] : []),
    ],
    prompts: timeline.segments.flatMap((s) => (s.prompt ? [s.prompt] : [])),
  };
}

/** Run every applicable rule. Plain rules first; classifiers only if nothing is already blocked. */
export async function runRules(spec: OutputSpec, timeline: Timeline): Promise<RuleResult[]> {
  const input = buildRuleInput(spec, timeline);
  const plain = PLAIN_RULES.filter((r) => r.appliesTo(spec));
  const results: RuleResult[] = [];
  for (const rule of plain) results.push(await rule.check(input));

  if (worst(results) !== "block") {
    for (const rule of CLASSIFIER_RULES.filter((r) => r.appliesTo(spec))) {
      results.push(await rule.check(input));
    }
  }
  return results;
}

/** Check a single line of text (used on hooks straight after generation). */
export async function checkText(spec: OutputSpec, text: string): Promise<RuleResult[]> {
  return runRules(spec, { segments: [{ type: "text", start: 0, duration: spec.minSeconds, text }] });
}

export function worst(results: RuleResult[]): RuleOutcome {
  if (results.some((r) => r.result === "block")) return "block";
  if (results.some((r) => r.result === "warn")) return "warn";
  return "pass";
}
