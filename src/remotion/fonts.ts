import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Geist:wght@400;600;700&display=block";

/** Load the brand fonts once and hold the render until they are ready. */
export function useBrandFonts() {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_CSS;
      document.head.appendChild(link);
    }
    const done = () => continueRender(handle);
    // Fonts are a nicety: never block a render for more than a few seconds on them.
    const timeout = setTimeout(done, 5000);
    void document.fonts.load('900 64px "Archivo"').then(() => document.fonts.ready).then(() => {
      clearTimeout(timeout);
      done();
    }, done);
  }, [handle]);
}
