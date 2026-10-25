import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS } from "@/lib/media/clips";
import { ownedPack } from "@/lib/owned";
import { createUploadUrl, paths } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(["video/mp4", "video/quicktime"]),
  durationS: z.number(),
});

/** Start a recording upload: create the source row and a signed upload URL the browser PUTs to. */
export async function POST(req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const pack = await ownedPack((await params).packId);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload an MP4 or MOV file" }, { status: 400 });
  const { fileName, contentType, durationS } = parsed.data;
  if (durationS < MIN_RECORDING_SECONDS - 0.5 || durationS > MAX_RECORDING_SECONDS + 0.5) {
    return NextResponse.json(
      { error: `The recording is ${Math.round(durationS)} seconds. It needs to be ${MIN_RECORDING_SECONDS} to ${MAX_RECORDING_SECONDS}.` },
      { status: 400 },
    );
  }

  const sourceId = crypto.randomUUID();
  const path = paths.recording(pack.id, sourceId, contentType === "video/quicktime" ? "mov" : "mp4");
  const { error } = await supabaseAdmin()
    .from("sources")
    .insert({ id: sourceId, pack_id: pack.id, kind: "recording", url: path, file_name: fileName, duration_s: durationS });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const upload = await createUploadUrl(path);
  return NextResponse.json({ sourceId, uploadUrl: upload.signedUrl });
}
