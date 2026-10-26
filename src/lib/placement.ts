import { OUTPUT_SPECS, type OutputSpecId } from "@/lib/specs/outputs";
import { STILL_SPECS, stillsFor } from "@/lib/specs/stills";

export const PACK_ZIP = "trailerly-pack.zip";
export const SHEET = "WHERE-EACH-FILE-GOES.txt";

const WHERE: Partial<Record<OutputSpecId, string>> = {
  preview: "App preview video for iPhone (6.9-inch display). Upload it with your screenshots for the version.",
  header: "Header video at the top of your App Store page (iOS 27).",
  search: "Search result video (iOS 27).",
};

/** Every file in a paid pack, in the order the sheet lists them. */
export function packFiles(specs: OutputSpecId[]): Array<{ fileName: string; where: string }> {
  return specs.flatMap((id) => {
    const spec = OUTPUT_SPECS[id];
    const where = spec.variantOf
      ? `Treatment ${spec.variant} for Product Page Optimization: the same cut as ${OUTPUT_SPECS[spec.variantOf].fileName} with another hook.`
      : WHERE[id] ?? spec.label;
    return [
      { fileName: spec.fileName, where },
      ...stillsFor(id).map((s) => ({
        fileName: s.fileName,
        where: `${STILL_SPECS[s.id].label} (${s.width}×${s.height}, no transparency): the image for this slot when video doesn't play.`,
      })),
    ];
  });
}

/** The one-page sheet that ships in the zip. */
export function placementSheet(appName: string, files: Array<{ fileName: string; where: string }>): string {
  return [
    `${appName}: your Trailerly pack`,
    "",
    "Where each file goes in App Store Connect:",
    "",
    ...files.flatMap((f) => [f.fileName, `  ${f.where}`, ""]),
  ].join("\n");
}
