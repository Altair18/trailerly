// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { type PackState, usePack } from "@/app/packs/[packId]/usePack";

afterEach(() => vi.useRealTimers());

it("keeps polling while busy even when a poll finds nothing new", async () => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const body = { id: "p", outputs: [{ spec: "preview", status: "rendering", draft_url: null }], images: {} };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const busy = (p: PackState) => p.outputs.some((o) => o.status === "rendering");
  function Probe() {
    usePack("p", busy);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  for (let i = 0; i < 3; i++) await act(async () => vi.advanceTimersByTimeAsync(2000));
  // The first load plus one every 2 s, though every answer was identical.
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
