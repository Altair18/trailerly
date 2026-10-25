import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

// display=swap: if the fonts are slow, text shows in a fallback face instead of rendering invisible.
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Geist:wght@400;600;700&display=swap";

/** Resolves once the stylesheet has loaded (or failed), so its @font-face rules exist before we ask for the fonts. */
function stylesheet(): Promise<void> {
  let link = document.querySelector<HTMLLinkElement>(`link[href="${FONTS_CSS}"]`);
  if (link?.sheet) return Promise.resolve();
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_CSS;
    document.head.appendChild(link);
  }
  const el = link;
  return new Promise((resolve) => {
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => resolve(), { once: true });
  });
}

/** Load the brand fonts once and hold the render until they are ready. */
export function useBrandFonts() {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
    };
    // Fonts are a nicety: never block a render for more than a few seconds on them.
    const timeout = setTimeout(done, 8000);
    // Asking for a font before its @font-face rule exists resolves at once with nothing loaded, which let
    // frames render while the text was still invisible (seen on a still). Wait for the stylesheet first.
    void stylesheet()
      .then(() => Promise.all([document.fonts.load('900 64px "Archivo"'), document.fonts.load('600 64px "Geist"')]))
      .then(() => document.fonts.ready)
      .then(
        () => {
          clearTimeout(timeout);
          done();
        },
        done,
      );
  }, [handle]);
}
