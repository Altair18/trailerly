import type { Rule } from "../types";

// Fuzzy checks that need a model. Stubbed: each returns pass until implemented (M4).

export const noFirstPersonResults: Rule = {
  id: "no_first_person_results",
  kind: "classifier",
  appliesTo: () => true,
  check: async () => {
    // TODO(M4): classify texts for first-person results ("I saved", "my results").
    // Block unless the user marked the line as a real quote with permission.
    return { rule: "no_first_person_results", result: "pass", detail: "Not yet implemented." };
  },
};

export const noRealPeopleInPrompts: Rule = {
  id: "no_real_people_in_prompts",
  kind: "classifier",
  appliesTo: () => true,
  check: async () => {
    // TODO(M3): name check on AI scene prompts for real people or celebrities.
    return { rule: "no_real_people_in_prompts", result: "pass", detail: "Not yet implemented." };
  },
};

export const ageRatingFourPlus: Rule = {
  id: "age_rating_4_plus",
  kind: "classifier",
  appliesTo: (s) => s.placement === "appstore",
  check: async () => {
    // TODO(M3): vision check on sampled frames for content above a 4+ rating.
    return { rule: "age_rating_4_plus", result: "pass", detail: "Not yet implemented." };
  },
};

export const CLASSIFIER_RULES: Rule[] = [noFirstPersonResults, noRealPeopleInPrompts, ageRatingFourPlus];
