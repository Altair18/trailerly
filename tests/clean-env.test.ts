import { describe, expect, it } from "vitest";
import { cleanEnv } from "@/lib/clean-env";

describe("cleanEnv", () => {
  it("strips a BOM, zero-width characters and whitespace", () => {
    expect(cleanEnv("﻿abc.def​\r\n")).toBe("abc.def");
  });
  it("treats empty and undefined as unset", () => {
    expect(cleanEnv("  ")).toBeUndefined();
    expect(cleanEnv(undefined)).toBeUndefined();
  });
  it("leaves normal values alone", () => {
    expect(cleanEnv("https://x.supabase.co")).toBe("https://x.supabase.co");
  });
});
