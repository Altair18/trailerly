import { logger, task } from "@trigger.dev/sdk";
import type { PackPayload } from "./payload";

/** Stage 10: C2PA credentials on AI files, zip with placement names, and the placement sheet. */
export const packagePack = task({
  id: "package",
  run: async ({ packId }: PackPayload) => {
    logger.info("package stub", { packId });
    // TODO(M4): c2patool on outputs with AI scenes; zip using OUTPUT_SPECS[*].fileName;
    // generate the one-page sheet (where each file goes, which AI label to tick).
    return { zipUrl: null as string | null };
  },
});
