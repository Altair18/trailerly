import { NextResponse } from "next/server";

/** Pack status for the UI to poll. The web app never waits on a video model. */
export async function GET(_req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  // TODO(M1): read packs + outputs via supabaseServer() so RLS applies.
  return NextResponse.json({ packId, status: "draft" });
}
