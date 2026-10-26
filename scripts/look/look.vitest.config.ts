import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Local look loop for the header and search videos, on a scripted demo app (no personal data):
//   OUT=/some/dir; cp scripts/look/app.html scripts/look/icon.html $OUT
//   node scripts/look/record.cjs $OUT && ffmpeg -i $OUT/*.webm -r 30 -pix_fmt yuv420p $OUT/demo.mp4
//   node scripts/look/icon.cjs $OUT
//   DEMO_DIR=$OUT LOOK_FILE=scripts/look/prep.test.ts npx vitest run --config scripts/look/look.vitest.config.ts
//   DEMO_DIR=$OUT LOOK_FILE=scripts/look/render.test.ts [ONLY=header] [SCALE=0.5] [LOOKS=studio,cinematic,bold] npx vitest run --config ...
// Set REMOTION_BROWSER_EXECUTABLE to a local Chrome headless shell where Remotion can't download one.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: { include: [process.env.LOOK_FILE ?? "scripts/look/render.test.ts"], testTimeout: 30 * 60_000, reporters: ["verbose"] },
});
