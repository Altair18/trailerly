import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutProblem, finalStatus, finalsBusy } from "@/lib/payment";

describe("checkoutProblem", () => {
  const ready = (spec: "preview" | "header" | "search", rules_status: "pass" | "warn" | "block" | null = "pass") =>
    ({ spec, status: "ready" as const, rules_status });
  const specs = ["preview", "header", "search"] as const;

  it("opens checkout when every draft is ready and nothing blocks", () => {
    expect(checkoutProblem("draft", [ready("preview"), ready("header", "warn"), ready("search")], [...specs])).toBeNull();
  });
  it("refuses a pack that's already paid", () => {
    expect(checkoutProblem("paid", [ready("preview"), ready("header"), ready("search")], [...specs])).toMatch(/already paid/);
  });
  it("waits for drafts still rendering or missing", () => {
    expect(checkoutProblem("draft", [ready("preview"), { spec: "header", status: "rendering", rules_status: null }, ready("search")], [...specs])).toMatch(/Wait/);
    expect(checkoutProblem("draft", [ready("preview"), ready("header")], [...specs])).toMatch(/Wait/);
  });
  it("refuses a draft that breaks a store rule", () => {
    expect(checkoutProblem("draft", [ready("preview", "block"), ready("header"), ready("search")], [...specs])).toMatch(/rule/);
  });
});

describe("final status", () => {
  it("is ready only when every spec rendered", () => {
    expect(finalStatus(["preview", "header"], ["header", "preview"])).toBe("ready");
    expect(finalStatus(["preview", "header"], ["preview"])).toBe("failed");
  });
  it("shows progress while paid or rendering", () => {
    expect(finalsBusy("paid")).toBe(true);
    expect(finalsBusy("rendering")).toBe(true);
    expect(finalsBusy("ready")).toBe(false);
    expect(finalsBusy("draft")).toBe(false);
  });
});

// The webhook: Stripe delivers each event at least once, so only the first delivery may start a render.
const trigger = vi.fn();
const inserted: string[] = [];
const statusUpdates: string[] = [];
let event: unknown;

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: (...a: unknown[]) => trigger(...a) } }));
vi.mock("@/lib/env", () => ({ requireEnv: () => "whsec_test" }));
vi.mock("@/lib/stripe", () => ({ stripe: () => ({ webhooks: { constructEvent: () => event } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      upsert: (row: { stripe_session_id: string }) => ({
        select: async () => {
          if (inserted.includes(row.stripe_session_id)) return { data: [], error: null };
          inserted.push(row.stripe_session_id);
          return { data: [{ id: "pay_1" }], error: null };
        },
      }),
      update: (u: { status: string }) => ({
        eq: () => ({ eq: async () => (statusUpdates.push(`${table}:${u.status}`), { error: null }) }),
      }),
    }),
  }),
}));

const session = (payment_status: string) => ({
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", metadata: { packId: "pack-1" }, payment_status, amount_total: 1900 } },
});
const post = async () => {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(new Request("http://x/api/stripe/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "sig" } }));
};

describe("stripe webhook", () => {
  beforeEach(() => {
    trigger.mockReset();
    inserted.length = 0;
    statusUpdates.length = 0;
  });

  it("records the payment, marks the pack paid and starts one final render", async () => {
    event = session("paid");
    expect((await post()).status).toBe(200);
    expect(statusUpdates).toEqual(["packs:paid"]);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0]![0]).toBe("render-final");
  });

  it("ignores a repeat delivery of the same session", async () => {
    event = session("paid");
    await post();
    await post();
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("waits for delayed payments to clear", async () => {
    event = session("unpaid");
    await post();
    expect(trigger).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });
});
