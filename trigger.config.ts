import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_trailerly",
  dirs: ["./src/trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 3, minTimeoutInMs: 1000, maxTimeoutInMs: 30000, factor: 2 },
  },
  build: {
    // ffmpeg for recording prep; Remotion's renderer is installed as a normal dependency
    // and downloads its headless browser on first render.
    extensions: [ffmpeg()],
    external: ["@remotion/renderer", "@remotion/bundler", "@remotion/compositor-linux-x64-gnu"],
  },
});
