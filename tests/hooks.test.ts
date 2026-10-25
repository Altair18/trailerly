import { describe, expect, it } from "vitest";
import { collectHooks, hookPasses, validateChosen } from "@/lib/hooks";
import type { Hook } from "@/lib/schemas/hooks";

const hook = (text: string): Hook => ({ text, format: "problem" });

describe("collectHooks", () => {
  it("tops up across rounds and drops blocked or duplicate hooks", async () => {
    const calls: Array<{ count: number; rejected: string[] }> = [];
    const batches = [
      [...Array.from({ length: 8 }, (_, i) => hook(`Clean hook ${i}`)), hook("Only $4.99 today"), hook("Clean hook 0")],
      [hook("Clean hook 8"), hook("Clean hook 9"), hook("Clean hook 10")],
    ];
    const result = await collectHooks(async (args) => {
      calls.push({ count: args.count, rejected: [...args.rejected] });
      return batches[calls.length - 1] ?? [];
    });

    expect(result).toHaveLength(10);
    expect(result.map((h) => h.text)).not.toContain("Only $4.99 today");
    expect(calls[1]).toEqual({ count: 2, rejected: ["Only $4.99 today"] });
  });

  it("gives up after three rounds", async () => {
    let n = 0;
    const result = await collectHooks(async () => {
      n++;
      return [hook("The #1 plant app")];
    });
    expect(n).toBe(3);
    expect(result).toEqual([]);
  });
});

describe("hookPasses", () => {
  it("uses App Store strictness", async () => {
    expect(await hookPasses(hook("The best plant app"))).toBe(false);
    expect(await hookPasses(hook("Never forget to water again"))).toBe(true);
  });
});

describe("validateChosen", () => {
  const proposed = [hook("A"), hook("B"), hook("C")];
  it("accepts picks from the proposed hooks", () => {
    expect(validateChosen({ social: ["A", "B"], headline: "C" }, proposed)).toBeNull();
  });
  it("rejects unknown or repeated picks", () => {
    expect(validateChosen({ social: ["Z"], headline: null }, proposed)).toMatch(/isn't one/);
    expect(validateChosen({ social: ["A", "A"], headline: null }, proposed)).toMatch(/once/);
  });
});
