import { expect, it } from "vitest";
import { fullSize } from "@/lib/media/screenshots";

it("asks Apple's image server for a full-size screenshot", () => {
  expect(fullSize("https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/ab/cd/x.png/392x696bb.jpg")).toBe("https://is1-ssl.mzstatic.com/image/thumb/Purple/v4/ab/cd/x.png/1290x2290bb.jpg");
  expect(fullSize("https://is1-ssl.mzstatic.com/image/thumb/a/2048x1536bb.png")).toBe("https://is1-ssl.mzstatic.com/image/thumb/a/2048x1536bb.png");
  expect(fullSize("https://example.com/shot.png")).toBe("https://example.com/shot.png");
});
