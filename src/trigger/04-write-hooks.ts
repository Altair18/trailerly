import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import { checkText, worst } from "@/lib/rules";
import type { Brief } from "@/lib/schemas/brief";
import { HookSet } from "@/lib/schemas/hooks";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";
import type { PackPayload } from "./payload";

/** Stage 4: ten hooks, each rules-checked straight away so a bad one never reaches the user. */
export const writeHooks = task({
  id: "write-hooks",
  run: async ({ packId, brief }: PackPayload & { brief: Brief }) => {
    const { hooks } = await generateJson({
      schema: HookSet,
      system:
        "You write scroll-stopping hooks for app ads. Return exactly 10 hooks of 8 words or fewer, " +
        "each tagged with a format: pov, problem, before_after, list, or question. No prices, no rankings.",
      prompt: JSON.stringify(brief),
    });

    // Strictest placement, so any hook is safe to use as the App Store headline.
    const checked = await Promise.all(
      hooks.map(async (h) => ({ ...h, rules: worst(await checkText(OUTPUT_SPECS.header, h.text)) })),
    );
    const usable = checked.filter((h) => h.rules !== "block");
    logger.info("Hooks written", { packId, usable: usable.length });
    // TODO(M1): regenerate blocked hooks until there are 10; save to the pack.
    return { hooks: usable };
  },
});
