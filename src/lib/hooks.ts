import { checkText, worst } from "@/lib/rules";
import { type ChosenHooks, fitsWordLimit, HOOK_COUNT, type Hook, type HookDraft, MAX_HOOK_WORDS } from "@/lib/schemas/hooks";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";

export const MAX_HOOK_ROUNDS = 3;

/** A hook passes if it isn't blocked for the strictest placement, so any hook can be the headline. */
export async function hookPasses(hook: Hook): Promise<boolean> {
  return worst(await checkText(OUTPUT_SPECS.header, hook.text)) !== "block";
}

/**
 * Ask for hooks until there are HOOK_COUNT unique ones that fit the word limit and pass the rules,
 * telling the model which ones were rejected and why. Gives up after MAX_HOOK_ROUNDS.
 */
export async function collectHooks(
  generate: (args: { count: number; rejected: string[]; kept: string[] }) => Promise<HookDraft[]>,
  passes: (hook: Hook) => Promise<boolean> = hookPasses,
): Promise<Hook[]> {
  const kept: Hook[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (let round = 0; round < MAX_HOOK_ROUNDS && kept.length < HOOK_COUNT; round++) {
    const batch = await generate({
      count: HOOK_COUNT - kept.length,
      rejected,
      kept: kept.map((h) => h.text),
    });
    for (const hook of batch) {
      const key = hook.text.trim().toLowerCase();
      if (seen.has(key) || kept.length >= HOOK_COUNT) continue;
      seen.add(key);
      if (!fitsWordLimit(hook.text)) rejected.push(`${hook.text} (over ${MAX_HOOK_WORDS} words)`);
      else if (await passes(hook)) kept.push(hook);
      else rejected.push(hook.text);
    }
  }
  return kept;
}

/** Picks must come from the proposed hooks. Returns an error message, or null if valid. */
export function validateChosen(chosen: ChosenHooks, proposed: Hook[]): string | null {
  const texts = new Set(proposed.map((h) => h.text));
  if (new Set(chosen.social).size !== chosen.social.length) return "Each hook can be picked once.";
  const unknown = [...chosen.social, ...(chosen.headline ? [chosen.headline] : [])].find((t) => !texts.has(t));
  return unknown ? `"${unknown}" isn't one of the proposed hooks.` : null;
}
