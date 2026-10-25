import { sumSeconds } from "@/lib/timeline/enforce";
import type { Rule } from "../types";

const isAppStore = (s: { placement: string }) => s.placement === "appstore";
const all = () => true;

export const previewNoAiScenes: Rule = {
  id: "preview_no_ai_scene",
  kind: "plain",
  appliesTo: (s) => s.id === "preview",
  check: ({ timeline }) =>
    timeline.segments.some((s) => s.type === "ai_scene")
      ? { rule: "preview_no_ai_scene", result: "block", detail: "App Store previews must be screen capture only (Apple 2.3.4)." }
      : { rule: "preview_no_ai_scene", result: "pass" },
};

export const lengthInSpec: Rule = {
  id: "length_in_spec",
  kind: "plain",
  appliesTo: all,
  check: ({ spec, timeline }) => {
    const total = Math.max(...timeline.segments.map((s) => s.start + s.duration));
    return total < spec.minSeconds || total > spec.maxSeconds
      ? { rule: "length_in_spec", result: "block", detail: `${total}s is outside ${spec.minSeconds} to ${spec.maxSeconds}s.` }
      : { rule: "length_in_spec", result: "pass" };
  },
};

// Currency symbols, "% off", money words next to numbers, "free trial".
const PRICE_RE =
  /[£$€]\s?\d|\d+\s?%\s?off|\bfree\s+trial\b|\b\d+(\.\d+)?\s?(dollars?|pounds?|euros?|usd|gbp|eur)\b|\b(discount|sale|half price)\b/i;

export const noPrices: Rule = {
  id: "no_prices",
  kind: "plain",
  appliesTo: isAppStore,
  check: ({ texts }) => {
    const hit = texts.find((t) => PRICE_RE.test(t));
    return hit
      ? { rule: "no_prices", result: "block", detail: `Price or offer wording: "${hit}".` }
      : { rule: "no_prices", result: "pass" };
  },
};

const SUPERLATIVE_RE = /#\s?1\b|\bnumber one\b|\bbest\b|\baward(-winning)?\b|\beditor'?s'? choice\b/i;

export const noSuperlatives: Rule = {
  id: "no_superlatives",
  kind: "plain",
  appliesTo: all,
  check: ({ spec, texts }) => {
    const hit = texts.find((t) => SUPERLATIVE_RE.test(t));
    if (!hit) return { rule: "no_superlatives", result: "pass" };
    return {
      rule: "no_superlatives",
      result: isAppStore(spec) ? "block" : "warn",
      detail: `Ranking or award claim: "${hit}".`,
    };
  },
};

const OTHER_PLATFORM_RE = /\b(android|google play|play store|samsung galaxy|pixel)\b/i;

export const noOtherPlatforms: Rule = {
  id: "no_other_platforms",
  kind: "plain",
  appliesTo: isAppStore,
  check: ({ texts }) => {
    const hit = texts.find((t) => OTHER_PLATFORM_RE.test(t));
    return hit
      ? { rule: "no_other_platforms", result: "block", detail: `Mentions another platform: "${hit}".` }
      : { rule: "no_other_platforms", result: "pass" };
  },
};

export const aiScenesLabelled: Rule = {
  id: "ai_scenes_labelled",
  kind: "plain",
  appliesTo: all,
  check: ({ timeline }) =>
    sumSeconds(timeline, "ai_scene") > 0
      ? { rule: "ai_scenes_labelled", result: "pass", detail: "Contains AI scenes.", effects: ["c2pa", "ai_label"] }
      : { rule: "ai_scenes_labelled", result: "pass" },
};

export const PLAIN_RULES: Rule[] = [
  previewNoAiScenes,
  lengthInSpec,
  noPrices,
  noSuperlatives,
  noOtherPlatforms,
  aiScenesLabelled,
];
