import { rm } from "node:fs/promises";
import path from "node:path";
import { flattenPng } from "@/lib/media/ffmpeg";
import type { OutputSpecId } from "@/lib/specs/outputs";
import { stillCompositionId, type StillId } from "@/lib/specs/stills";
import { compositionId, type RenderProps } from "@/remotion/Root";

let bundled: Promise<string> | undefined;

/** Bundle the Remotion project once per worker process. */
function bundleOnce(): Promise<string> {
  bundled ??= import("@remotion/bundler").then(({ bundle }) =>
    bundle({
      entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: { ...(config.resolve?.alias as object), "@": path.join(process.cwd(), "src") },
        },
      }),
    }),
  );
  return bundled;
}

/** Render one output's composition to an MP4 file. Runs on the worker, never in the web app. */
export async function renderOutput(opts: {
  spec: OutputSpecId;
  props: RenderProps;
  outFile: string;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const composition = await selectComposition({ serveUrl, id: compositionId(opts.spec), inputProps: opts.props, browserExecutable });
  await renderMedia({
    serveUrl,
    composition,
    inputProps: opts.props,
    codec: "h264",
    muted: true,
    outputLocation: opts.outFile,
    browserExecutable,
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
}

/** Render one frame of a still composition to an RGB PNG (no alpha). */
export async function renderStillImage(opts: { still: StillId; props: RenderProps; frame: number; outFile: string }): Promise<void> {
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const id = stillCompositionId(opts.still);
  const composition = await selectComposition({ serveUrl, id, inputProps: opts.props, browserExecutable });
  const raw = `${opts.outFile}.raw.png`;
  await renderStill({
    serveUrl,
    composition,
    inputProps: opts.props,
    frame: Math.min(Math.max(0, opts.frame), composition.durationInFrames - 1),
    imageFormat: "png",
    output: raw,
    browserExecutable,
  });
  await flattenPng(raw, opts.outFile);
  await rm(raw, { force: true });
}
