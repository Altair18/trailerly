import { describe, expect, it } from "vitest";
import { checkText, worst } from "@/lib/rules";
import { OUTPUT_SPECS } from "@/lib/specs/outputs";

describe("plain rules", () => {
  it("blocks prices on App Store videos", async () => {
    expect(worst(await checkText(OUTPUT_SPECS.header, "Only £4.99 this week"))).toBe("block");
    expect(worst(await checkText(OUTPUT_SPECS.header, "Start your free trial"))).toBe("block");
  });
  it("blocks rankings on App Store, warns on social", async () => {
    expect(worst(await checkText(OUTPUT_SPECS.search, "The #1 habit app"))).toBe("block");
    expect(worst(await checkText(OUTPUT_SPECS.social_1, "The best habit app"))).toBe("warn");
  });
  it("blocks other platforms on App Store", async () => {
    expect(worst(await checkText(OUTPUT_SPECS.header, "Also on Android"))).toBe("block");
  });
  it("passes a clean hook", async () => {
    expect(worst(await checkText(OUTPUT_SPECS.header, "Stop forgetting your plants"))).toBe("pass");
  });
});
