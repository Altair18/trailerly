import { describe, expect, it, vi } from "vitest";

vi.mock("@trigger.dev/sdk", () => ({ logger: {}, metadata: {}, task: (t: unknown) => t }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));

describe("errorText", () => {
  it("never comes back empty", async () => {
    const { errorText } = await import("@/trigger/08-compose");
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText(new Error(""))).not.toBe("");
    expect(errorText("")).toBe("Unknown error");
    expect(errorText({ code: 1 })).toBe('{"code":1}');
    expect(errorText(undefined)).toBe("Unknown error");
  });
});
