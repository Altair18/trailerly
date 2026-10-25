import { logger, task } from "@trigger.dev/sdk";
import { generateJson } from "@/lib/llm/claude";
import type { Brief } from "@/lib/schemas/brief";
import { ShotListReply } from "@/lib/schemas/shotlist";
import { SHOTLIST_SYSTEM, writeShotList } from "@/lib/shotlist";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PackPayload } from "./payload";

/** Stage 3b: a 5 to 6 shot recording plan from the brief, shown on the recording page before upload. */
export const writeShotListTask = task({
  id: "write-shot-list",
  retry: { maxAttempts: 2 },
  run: async ({ packId, brief, appName }: PackPayload & { brief: Brief; appName: string }) => {
    const list = await writeShotList(brief, appName, (prompt) =>
      generateJson({ schema: ShotListReply, system: SHOTLIST_SYSTEM, prompt, maxTokens: 1024 }),
    );
    const { error } = await supabaseAdmin().from("packs").update({ shot_list_json: list }).eq("id", packId);
    if (error) throw error;
    logger.info("Shot list written", { packId, shots: list.shots.length });
    return list;
  },
});
