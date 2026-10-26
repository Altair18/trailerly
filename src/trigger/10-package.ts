import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger, task } from "@trigger.dev/sdk";
import { loadPackWithApp } from "@/lib/packs";
import { PACK_ZIP, SHEET, packFiles, placementSheet } from "@/lib/placement";
import type { OutputSpecId } from "@/lib/specs/outputs";
import { downloadTo, paths, uploadFile } from "@/lib/storage";
import { zipFiles } from "@/lib/zip";

/**
 * Stage 10: one zip of the full-size files with a sheet saying where each goes, for a single "download all".
 * The single files stay downloadable on their own, so a missing zip never blocks the pack.
 * TODO(M3): C2PA credentials on outputs with AI scenes, once those ship.
 */
export const packagePack = task({
  id: "package",
  run: async ({ packId, specs }: { packId: string; specs: OutputSpecId[] }) => {
    const { app } = await loadPackWithApp(packId);
    const dir = await mkdtemp(join(tmpdir(), "package-"));
    try {
      const listed = packFiles(specs);
      const files: Array<{ name: string; data: Uint8Array }> = [];
      const present: typeof listed = [];
      for (const f of listed) {
        const local = join(dir, f.fileName);
        try {
          await downloadTo(paths.final(packId, f.fileName), local);
          files.push({ name: f.fileName, data: await readFile(local) });
          present.push(f);
        } catch {
          logger.warn("Not in the zip: file missing", { packId, file: f.fileName });
        }
      }
      if (files.length === 0) return { zip: null as string | null };
      files.push({ name: SHEET, data: Buffer.from(placementSheet(app.name, present), "utf8") });
      const out = join(dir, PACK_ZIP);
      await writeFile(out, zipFiles(files));
      await uploadFile(paths.final(packId, PACK_ZIP), out, "application/zip");
      logger.info("Pack zipped", { packId, files: files.length });
      return { zip: paths.final(packId, PACK_ZIP) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
