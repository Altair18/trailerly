import { logger, task } from "@trigger.dev/sdk";
import { collectHooks } from "@/lib/hooks";
import { generateJson } from "@/lib/llm/claude";
import type { Brief } from "@/lib/schemas/brief";
import { HookSet } from "@/lib/schemas/hooks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

const SYSTEM = `You write scroll-stopping opening hooks for app videos.
Each hook is 8 words or fewer and is tagged with one format: pov, problem, before_after, list, or question.
Mix the formats. Use the brief's features and review phrases. Write about the viewer, not "I" or "my".
Never mention prices, discounts, free trials, rankings ("#1", "best"), awards, or other platforms (Android, Google Play).
Return JSON: {"hooks": [{"text": "...", "format": "..."}]}.`;

/** Stage 4: ten hooks, each rules-checked straight away so a bad one never reaches the user. */
export const writeHooks = task({
  id: "write-hooks",
  run: async ({ packId, brief }: PackPayload & { brief: Brief }) => {
    const hooks = await collectHooks(async ({ count, rejected, kept }) => {
      const { hooks } = await generateJson({
        schema: HookSet,
        system: SYSTEM,
        prompt: JSON.stringify({
          brief,
          write_this_many: count,
          already_have: kept,
          rejected_by_rules_do_not_repeat: rejected,
        }),
      });
      return hooks;
    });

    if (hooks.length === 0) throw new Error("No hooks passed the rules check.");
    const { error } = await supabaseAdmin().from("packs").update({ hooks_json: hooks }).eq("id", packId);
    if (error) throw error;
    logger.info("Hooks written", { packId, count: hooks.length });
    return { hooks };
  },
});
