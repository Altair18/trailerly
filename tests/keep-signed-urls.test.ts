import { describe, expect, it } from "vitest";
import { keepSignedUrls } from "@/app/packs/[packId]/usePack";

const signed = (path: string, token: string) => `https://x.supabase.co/storage/v1/object/sign/media/${path}?token=${token}`;

describe("keepSignedUrls", () => {
  it("keeps the URL on the page when only the token changed", () => {
    const prev = { outputs: [{ spec: "preview", status: "ready", draft_url: signed("a.mp4", "1") }], images: { shot_1: signed("s1.jpg", "1") } };
    const next = { outputs: [{ spec: "preview", status: "ready", draft_url: signed("a.mp4", "2") }], images: { shot_1: signed("s1.jpg", "2") } };
    const out = keepSignedUrls(prev, next);
    expect(out.outputs[0]!.draft_url).toBe(prev.outputs[0]!.draft_url);
    expect(out.images.shot_1).toBe(prev.images.shot_1);
    // Nothing really changed, so the same object comes back and React skips the render.
    expect(out).toBe(prev);
  });

  it("takes the new URL when the file changed, and new fields", () => {
    const prev = { outputs: [{ spec: "header", status: "rendering", draft_url: null as string | null }] };
    const next = { outputs: [{ spec: "header", status: "ready", draft_url: signed("h.mp4", "2") }] };
    const out = keepSignedUrls(prev, next);
    expect(out.outputs[0]).toEqual(next.outputs[0]);
    expect(keepSignedUrls({ u: signed("a.mp4", "1") }, { u: signed("b.mp4", "2") }).u).toBe(signed("b.mp4", "2"));
  });
});
