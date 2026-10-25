import { describe, expect, it } from "vitest";
import { parseAppStoreLink } from "@/lib/ingest/appstore";

describe("parseAppStoreLink", () => {
  it("reads id and country", () => {
    expect(parseAppStoreLink("https://apps.apple.com/gb/app/notion/id1232780281")).toEqual({
      storeId: "1232780281",
      country: "gb",
    });
  });
  it("defaults country to us", () => {
    expect(parseAppStoreLink("https://apps.apple.com/app/id123")).toEqual({ storeId: "123", country: "us" });
  });
  it("rejects other hosts", () => {
    expect(parseAppStoreLink("https://play.google.com/store/apps/details?id=123")).toBeNull();
    expect(parseAppStoreLink("not a url")).toBeNull();
  });
});
