import path from "node:path";
import type { OutputSpecId } from "@/lib/specs/outputs";
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
