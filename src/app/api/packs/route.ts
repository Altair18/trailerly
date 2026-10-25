import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAppStoreLink } from "@/lib/ingest/appstore";
import type { preparePack } from "@/trigger/pipelines";

const Body = z.object({ link: z.string() });

/** Create a pack from an App Store link and start the prepare run. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing link" }, { status: 400 });

  const link = parseAppStoreLink(parsed.data.link);
  if (!link) return NextResponse.json({ error: "That doesn't look like an App Store link" }, { status: 400 });

  // TODO(M1): require a signed-in user, upsert `apps`, insert `packs` with price and budget from env.
  const packId = crypto.randomUUID();

  if (process.env.TRIGGER_SECRET_KEY) {
    await tasks.trigger<typeof preparePack>("prepare-pack", { packId, link: parsed.data.link });
  }
  return NextResponse.json({ packId });
}
