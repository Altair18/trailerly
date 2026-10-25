import { additionalFiles, aptGet, ffmpeg } from "@trigger.dev/build/extensions/core";
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
    // ffmpeg for recording prep. Remotion bundles its compositions from source at render time,
    // so the worker image needs the source files (and whatever they import via "@/") plus the
    // packages that bundle resolves: remotion, react, react-dom and zod are kept external so
    // they are installed in the image. The renderer downloads its headless browser on first render.
    extensions: [
      ffmpeg(),
      // System libraries Remotion's headless Chrome needs on Debian.
      aptGet({
        packages: [
          "libnss3", "libdbus-1-3", "libatk1.0-0", "libgbm-dev", "libasound2", "libxrandr2",
          "libxkbcommon-dev", "libxfixes3", "libxcomposite1", "libxdamage1", "libatk-bridge2.0-0",
          "libpango-1.0-0", "libcairo2", "libcups2",
        ],
      }),
      additionalFiles({
        files: ["./src/remotion/**", "./src/lib/specs/**", "./src/lib/timeline/**"],
      }),
    ],
    external: [
      "@remotion/renderer",
      "@remotion/bundler",
      "@remotion/compositor-linux-x64-gnu",
      "remotion",
      "react",
      "react-dom",
      "zod",
    ],
  },
});
