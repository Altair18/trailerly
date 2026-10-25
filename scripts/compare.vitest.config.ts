import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs scripts/compare-planners.ts on its own (it calls the real API, so it is not part of `npm test`).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: { include: ["scripts/compare-planners.ts"], testTimeout: 15 * 60_000, reporters: ["verbose"] },
});
